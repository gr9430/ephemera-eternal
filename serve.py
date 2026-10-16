#!/usr/bin/env python3
"""serve.py — the workshop computers' local server.

Serves this folder like `python3 -m http.server`, on 127.0.0.1 only, and adds a small JSON API
that keeps participants' consented words in data/consented-words.json:

    GET  /api/words              {"pending": [...], "approved": [...]}  (the texts)
    POST /api/words              {"text": "..."}  adds the line to pending
    POST /api/words/approve      {"text": "..."}  pending -> approved
    POST /api/words/reject       {"text": "..."}  removes it from pending
    POST /api/words/unapprove    {"text": "..."}  approved -> pending

The file holds each line as typed, with when it was added (and approved). It never touches
data/grammar.json: Glenn copies approved lines into the grammar by hand. The file is git-ignored,
so participants' words aren't published with the site.

Run: python3 serve.py [port]    (default 8000), then open http://localhost:8000/?workshop
"""

import functools
import json
import os
import sys
import tempfile
import threading
import urllib.parse
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

WORDS_FILE = os.path.join('data', 'consented-words.json')
MAX_TEXT = 500
MAX_BODY = 16 * 1024
ACTIONS = {'/api/words': 'add', '/api/words/approve': 'approve',
           '/api/words/reject': 'reject', '/api/words/unapprove': 'unapprove'}
# Only this computer's own pages may use the API: other sites (and DNS rebinding) are refused
LOCAL_HOSTS = {'localhost', '127.0.0.1'}


def clean_text(text):
    """The line as it will be stored, or None when it can't be added."""
    if not isinstance(text, str):
        return None
    text = text.strip()
    if not text or len(text) > MAX_TEXT:
        return None
    return text


def now_stamp():
    return datetime.now().isoformat(timespec='seconds')


class WordsFile:
    """data/consented-words.json. Each change reads the file fresh, so Glenn's hand edits between
    requests are kept, and writes it whole, one change at a time. A file that can't be read is
    an error, never overwritten."""

    def __init__(self, path):
        self.path = path
        self.lock = threading.Lock()

    def read(self):
        if not os.path.exists(self.path):
            return {'pending': [], 'approved': []}
        with open(self.path, encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data, dict):
            raise ValueError('%s is not a JSON object' % self.path)
        return {'pending': list(data.get('pending', [])), 'approved': list(data.get('approved', []))}

    def lists(self, data=None):
        data = data if data is not None else self.read()
        return {status: [e['text'] for e in data[status]] for status in ('pending', 'approved')}

    def change(self, action, text):
        """Applies 'add', 'approve', 'reject' or 'unapprove' to text and returns the lists. A
        duplicate add, or a line that isn't where the action expects it, changes nothing."""
        with self.lock:
            data = self.read()
            pending, approved = data['pending'], data['approved']
            find = lambda entries: next((e for e in entries if e['text'] == text), None)
            in_pending, in_approved = find(pending), find(approved)
            changed = True
            if action == 'add' and not in_pending and not in_approved:
                pending.append({'text': text, 'addedAt': now_stamp()})
            elif action == 'approve' and in_pending:
                pending.remove(in_pending)
                approved.append(dict(in_pending, approvedAt=now_stamp()))
            elif action == 'reject' and in_pending:
                pending.remove(in_pending)
            elif action == 'unapprove' and in_approved:
                approved.remove(in_approved)
                entry = dict(in_approved)
                entry.pop('approvedAt', None)
                pending.append(entry)
            else:
                changed = False
            if changed:
                self.write(data)
            return self.lists(data)

    def write(self, data):
        folder = os.path.dirname(self.path)
        fd, tmp = tempfile.mkstemp(dir=folder, prefix='.consented-words-', suffix='.tmp')
        try:
            with os.fdopen(fd, 'w', encoding='utf-8', newline='') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.write('\n')
            if os.path.exists(self.path):
                os.chmod(tmp, os.stat(self.path).st_mode & 0o777)
            else:
                os.chmod(tmp, 0o644)
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

    def is_local(self):
        """True when the request names this computer and comes from one of its pages. A browser
        always sends Origin on a POST; its absence means a non-browser client here, e.g. curl."""
        host = urllib.parse.urlsplit('//' + (self.headers.get('Host') or '')).hostname
        origin = self.headers.get('Origin')
        return host in LOCAL_HOSTS and (origin is None or urllib.parse.urlsplit(origin).hostname in LOCAL_HOSTS)

    def do_GET(self):
        if self.route() == '/api/words':
            if not self.is_local():
                return self.send_json(HTTPStatus.FORBIDDEN, {'error': 'Only this computer may use the words API'})
            try:
                return self.send_json(HTTPStatus.OK, self.words.lists())
            except (OSError, ValueError, KeyError, TypeError) as e:
                return self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {'error': str(e)})
        return super().do_GET()

    def do_POST(self):
        action = ACTIONS.get(self.route())
        if not action:
            return self.send_json(HTTPStatus.NOT_FOUND, {'error': 'Not found'})
        if not self.is_local():
            return self.send_json(HTTPStatus.FORBIDDEN, {'error': 'Only this computer may use the words API'})
        # JSON needs a CORS preflight, which this server never answers, so other sites can't send it
        if self.headers.get_content_type() != 'application/json':
            return self.send_json(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, {'error': 'Send JSON'})
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
        except (OSError, ValueError, KeyError, TypeError) as e:
            return self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {'error': str(e)})
        self.send_json(HTTPStatus.OK, dict(ok=True, **lists))


def make_server(root, port=8000):
    words = WordsFile(os.path.join(root, WORDS_FILE))
    handler = functools.partial(Handler, directory=root, words=words)
    return ThreadingHTTPServer(('127.0.0.1', port), handler)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = make_server(os.path.dirname(os.path.abspath(__file__)), port)
    print('Workshop: http://localhost:%d/?workshop   (Ctrl+C to stop)' % port)
    print('Consented words go to %s' % WORDS_FILE)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
