#!/usr/bin/env python3
"""serve.py — the workshop computers' local server.

Serves this folder like `python3 -m http.server`, on 127.0.0.1 only, and adds a small JSON API
that writes participants' consented words into data/grammar.json:

    GET  /api/words              {"pending": [...], "approved": [...]}
    POST /api/words              {"text": "..."}  adds the line to participant_pending
    POST /api/words/approve      {"text": "..."}  participant_pending -> participant
    POST /api/words/reject       {"text": "..."}  removes it from participant_pending
    POST /api/words/unapprove    {"text": "..."}  participant -> participant_pending

No rule references participant_pending, so the generator never uses a line until Glenn approves
it. origin references participant once, from the first approval on. Glenn can repeat it by hand
to raise the share, and the server never adds a second one.

Run: python3 serve.py [port]    (default 8000), then open http://localhost:8000/?workshop
"""

import functools
import json
import os
import sys
import tempfile
import threading
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PENDING = 'participant_pending'
APPROVED = 'participant'
REFERENCE = '#participant#'
MAX_TEXT = 500
MAX_BODY = 16 * 1024
ACTIONS = {'/api/words': 'add', '/api/words/approve': 'approve',
           '/api/words/reject': 'reject', '/api/words/unapprove': 'unapprove'}
# Tracery reads # and [ ] as markup; look-alikes let a participant's line print as typed
MARKUP = str.maketrans({'#': '＃', '[': '［', ']': '］'})


def dump_grammar(grammar):
    """grammar.json's own layout: one symbol per line, a blank line between symbols."""
    lines = ['  %s: %s' % (json.dumps(key, ensure_ascii=False), json.dumps(value, ensure_ascii=False))
             for key, value in grammar.items()]
    return '{\n' + ',\n\n'.join(lines) + '\n}'


def clean_text(text):
    """The line as it will be stored, or None when it can't be added."""
    if not isinstance(text, str):
        return None
    text = text.strip().translate(MARKUP)
    if not text or len(text) > MAX_TEXT:
        return None
    return text


class WordsFile:
    """The participant symbols in data/grammar.json. Each change reads the file fresh, so Glenn's
    hand edits between requests are kept, and writes it whole, one change at a time."""

    def __init__(self, path):
        self.path = path
        self.lock = threading.Lock()

    def read(self):
        with open(self.path, encoding='utf-8') as f:
            return json.load(f)

    def lists(self, grammar=None):
        g = grammar if grammar is not None else self.read()
        return {'pending': list(g.get(PENDING, [])), 'approved': list(g.get(APPROVED, []))}

    def change(self, action, text):
        """Applies 'add', 'approve', 'reject' or 'unapprove' to text and returns the lists. A
        duplicate add, or a line that isn't where the action expects it, changes nothing."""
        with self.lock:
            g = self.read()
            before = dump_grammar(g)
            if APPROVED not in g:
                g[APPROVED] = []
            if PENDING not in g:
                g[PENDING] = []
            pending, approved = g[PENDING], g[APPROVED]
            if action == 'add' and text not in pending and text not in approved:
                pending.append(text)
            elif action == 'approve' and text in pending:
                pending.remove(text)
                approved.append(text)
            elif action == 'reject' and text in pending:
                pending.remove(text)
            elif action == 'unapprove' and text in approved:
                approved.remove(text)
                pending.append(text)
            origin = g.setdefault('origin', [])
            if approved and REFERENCE not in origin:
                origin.append(REFERENCE)
            elif not approved and REFERENCE in origin:
                # nothing left to expand: a bare reference would print "[participant]"
                g['origin'] = [rule for rule in origin if rule != REFERENCE]
            after = dump_grammar(g)
            if after != before or action == 'add':
                self.write(after)
            return self.lists(g)

    def write(self, text):
        folder = os.path.dirname(self.path)
        fd, tmp = tempfile.mkstemp(dir=folder, prefix='.grammar-', suffix='.tmp')
        try:
            with os.fdopen(fd, 'w', encoding='utf-8', newline='') as f:
                f.write(text)
            os.chmod(tmp, os.stat(self.path).st_mode & 0o777)
            os.replace(tmp, self.path)
        except BaseException:
            if os.path.exists(tmp):
                os.unlink(tmp)
            raise


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, words, **kwargs):
        self.words = words   # set before the base class handles the request
        super().__init__(*args, **kwargs)

    def route(self):
        return self.path.split('?', 1)[0]

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.route() == '/api/words':
            return self.send_json(HTTPStatus.OK, self.words.lists())
        return super().do_GET()

    def do_POST(self):
        action = ACTIONS.get(self.route())
        if not action:
            return self.send_json(HTTPStatus.NOT_FOUND, {'error': 'Not found'})
        try:
            length = int(self.headers.get('Content-Length') or 0)
            if length > MAX_BODY:
                raise ValueError('body too large')
            body = json.loads(self.rfile.read(length) or b'null')
        except ValueError:
            return self.send_json(HTTPStatus.BAD_REQUEST, {'error': 'Expected {"text": "..."}'})
        text = body.get('text') if isinstance(body, dict) else None
        if action == 'add':
            text = clean_text(text)
            if text is None:
                return self.send_json(HTTPStatus.BAD_REQUEST,
                                      {'error': 'Empty, or longer than %d characters' % MAX_TEXT})
        elif not isinstance(text, str):
            return self.send_json(HTTPStatus.BAD_REQUEST, {'error': 'Expected {"text": "..."}'})
        try:
            lists = self.words.change(action, text)
        except (OSError, ValueError) as e:
            return self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {'error': str(e)})
        self.send_json(HTTPStatus.OK, dict(ok=True, **lists))


def make_server(root, port=8000):
    words = WordsFile(os.path.join(root, 'data', 'grammar.json'))
    handler = functools.partial(Handler, directory=root, words=words)
    return ThreadingHTTPServer(('127.0.0.1', port), handler)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = make_server(os.path.dirname(os.path.abspath(__file__)), port)
    print('Workshop: http://localhost:%d/?workshop   (Ctrl+C to stop)' % port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
