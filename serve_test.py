"""serve_test.py — tests for serve.py, the workshop words server. Each test runs a real server on
a free port in a temporary folder, so data/consented-words.json and data/grammar.json are copies.

Run: python3 serve_test.py
"""

import json
import os
import shutil
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

import serve

ROOT = os.path.dirname(os.path.abspath(__file__))
GRAMMAR = os.path.join(ROOT, 'data', 'grammar.json')


def read_raw(path):
    with open(path, encoding='utf-8', newline='') as f:
        return f.read()


class ServerTest(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()
        os.mkdir(os.path.join(self.root, 'data'))
        self.path = os.path.join(self.root, 'data', 'consented-words.json')
        self.grammar_path = os.path.join(self.root, 'data', 'grammar.json')
        shutil.copy(GRAMMAR, self.grammar_path)
        with open(os.path.join(self.root, 'index.html'), 'w', encoding='utf-8') as f:
            f.write('<p>zine</p>')
        self.server = serve.make_server(self.root, 0)
        self.port = self.server.server_address[1]
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        shutil.rmtree(self.root)

    def call(self, path, body=None, raw_body=None, headers=None):
        data = raw_body if raw_body is not None else (None if body is None else json.dumps(body).encode())
        req = urllib.request.Request('http://127.0.0.1:%d%s' % (self.port, path), data=data,
                                     method='GET' if data is None else 'POST',
                                     headers=dict({'Content-Type': 'application/json'}, **(headers or {})))
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b'null')

    def add(self, text):
        return self.call('/api/words', {'text': text})

    def words(self):
        return json.loads(read_raw(self.path))

    def texts(self, status):
        return [e['text'] for e in self.words()[status]]

    def test_binds_to_localhost_only(self):
        self.assertEqual(self.server.server_address[0], '127.0.0.1')

    def test_serves_the_folder(self):
        with urllib.request.urlopen('http://127.0.0.1:%d/index.html' % self.port) as r:
            self.assertEqual(r.read(), b'<p>zine</p>')

    def test_no_file_yet_lists_empty_and_writes_nothing(self):
        self.assertEqual(self.call('/api/words'), (200, {'pending': [], 'approved': []}))
        self.assertFalse(os.path.exists(self.path))

    def test_add_trims_and_stamps(self):
        status, body = self.add('  the corner store remembers  ')
        self.assertEqual((status, body['pending'], body['approved']), (200, ['the corner store remembers'], []))
        entry = self.words()['pending'][0]
        self.assertEqual(entry['text'], 'the corner store remembers')
        self.assertRegex(entry['addedAt'], r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}')

    def test_never_touches_the_grammar(self):
        before = read_raw(self.grammar_path)
        self.add('one')
        self.add('two')
        self.call('/api/words/approve', {'text': 'one'})
        self.call('/api/words/reject', {'text': 'two'})
        self.call('/api/words/unapprove', {'text': 'one'})
        self.assertEqual(read_raw(self.grammar_path), before)

    def test_file_is_readable_json_as_typed(self):
        self.add('café ✊ #saveLou [sic]\nsecond line')
        raw = read_raw(self.path)
        self.assertIn('café ✊ #saveLou [sic]', raw)   # kept as typed: it's the consent record
        self.assertTrue(raw.startswith('{\n  "pending": ['))
        self.assertTrue(raw.endswith('}\n'))
        self.assertEqual(self.texts('pending'), ['café ✊ #saveLou [sic]\nsecond line'])

    def test_duplicates_succeed_without_adding(self):
        self.add('same line')
        self.assertEqual(self.add('same line')[0], 200)
        self.call('/api/words/approve', {'text': 'same line'})
        self.assertEqual(self.add(' same line ')[0], 200)
        self.assertEqual((self.texts('pending'), self.texts('approved')), ([], ['same line']))

    def test_refuses_empty_too_long_and_malformed(self):
        for body in ({'text': '   '}, {'text': 'x' * 501}, {'text': 42}, {}, ['text']):
            self.assertEqual(self.call('/api/words', body)[0], 400, body)
        self.assertEqual(self.call('/api/words', raw_body=b'{not json')[0], 400)
        self.assertFalse(os.path.exists(self.path))
        self.assertEqual(self.add('x' * 500)[0], 200)

    def test_approve_reject_unapprove(self):
        for text in ('one', 'two', 'three'):
            self.add(text)
        self.call('/api/words/approve', {'text': 'one'})
        self.call('/api/words/reject', {'text': 'two'})
        self.assertEqual((self.texts('pending'), self.texts('approved')), (['three'], ['one']))
        approved = self.words()['approved'][0]
        self.assertIn('addedAt', approved)
        self.assertIn('approvedAt', approved)
        status, body = self.call('/api/words/unapprove', {'text': 'one'})
        self.assertEqual((status, body['pending'], body['approved']), (200, ['three', 'one'], []))
        self.assertNotIn('approvedAt', self.words()['pending'][1])

    def test_actions_on_missing_lines_change_nothing(self):
        self.add('here')
        before = read_raw(self.path)
        for action in ('approve', 'reject', 'unapprove'):
            self.assertEqual(self.call('/api/words/' + action, {'text': 'not here'})[0], 200)
        self.assertEqual(read_raw(self.path), before)

    def test_keeps_hand_edits(self):
        self.add('one')
        data = self.words()
        data['approved'].append({'text': 'typed in by hand', 'addedAt': '2026-10-01T12:00:00'})
        with open(self.path, 'w', encoding='utf-8') as f:
            json.dump(data, f)
        self.add('two')
        self.assertEqual(self.texts('approved'), ['typed in by hand'])

    def test_unreadable_file_is_an_error_not_a_wipe(self):
        with open(self.path, 'w', encoding='utf-8') as f:
            f.write('{"pending": [')   # half-saved by hand
        self.assertEqual(self.call('/api/words')[0], 500)
        self.assertEqual(self.add('new words')[0], 500)
        self.assertEqual(read_raw(self.path), '{"pending": [')

    def test_refuses_other_content_types(self):
        # a text/plain POST needs no CORS preflight, so any web page could send one
        status, _ = self.call('/api/words', raw_body=b'{"text": "from another site"}', headers={'Content-Type': 'text/plain'})
        self.assertEqual(status, 415)
        self.assertFalse(os.path.exists(self.path))

    def test_refuses_other_origins(self):
        status, _ = self.call('/api/words', {'text': 'from another site'}, headers={'Origin': 'http://evil.example'})
        self.assertEqual(status, 403)
        self.assertFalse(os.path.exists(self.path))
        for origin in ('http://localhost:%d' % self.port, 'http://127.0.0.1:%d' % self.port):
            self.assertEqual(self.call('/api/words', {'text': origin}, headers={'Origin': origin})[0], 200)

    def test_refuses_other_hosts(self):
        # DNS rebinding: another site's name pointed at 127.0.0.1
        self.assertEqual(self.call('/api/words', headers={'Host': 'evil.example:%d' % self.port})[0], 403)
        self.assertEqual(self.call('/api/words', {'text': 'x'}, headers={'Host': 'evil.example'})[0], 403)

    def test_unknown_post_is_404(self):
        self.assertEqual(self.call('/api/nope', {'text': 'x'})[0], 404)

    def test_concurrent_adds_all_land(self):
        threads = [threading.Thread(target=self.add, args=('line %d' % i,)) for i in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(sorted(self.texts('pending')), sorted('line %d' % i for i in range(20)))
        self.assertEqual([n for n in os.listdir(os.path.join(self.root, 'data')) if n.endswith('.tmp')], [])


if __name__ == '__main__':
    unittest.main()
