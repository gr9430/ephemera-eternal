"""serve_test.py — tests for serve.py, the workshop words server. Each test runs a real server on
a free port against a temporary copy of data/grammar.json.

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


class LayoutTest(unittest.TestCase):
    def test_round_trip_is_byte_for_byte(self):
        raw = read_raw(GRAMMAR)
        self.assertEqual(serve.dump_grammar(json.loads(raw)), raw)


class ServerTest(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()
        os.mkdir(os.path.join(self.root, 'data'))
        self.path = os.path.join(self.root, 'data', 'grammar.json')
        shutil.copy(GRAMMAR, self.path)
        with open(os.path.join(self.root, 'index.html'), 'w', encoding='utf-8') as f:
            f.write('<p>zine</p>')
        self.server = serve.make_server(self.root, 0)
        self.port = self.server.server_address[1]
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        shutil.rmtree(self.root)

    def call(self, path, body=None, raw_body=None):
        data = raw_body if raw_body is not None else (None if body is None else json.dumps(body).encode())
        req = urllib.request.Request('http://127.0.0.1:%d%s' % (self.port, path), data=data,
                                     method='GET' if data is None else 'POST',
                                     headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b'null')

    def add(self, text):
        return self.call('/api/words', {'text': text})

    def grammar(self):
        return json.loads(read_raw(self.path))

    def test_binds_to_localhost_only(self):
        self.assertEqual(self.server.server_address[0], '127.0.0.1')

    def test_serves_the_folder(self):
        with urllib.request.urlopen('http://127.0.0.1:%d/index.html' % self.port) as r:
            self.assertEqual(r.read(), b'<p>zine</p>')

    def test_lists_start_empty_and_reading_writes_nothing(self):
        before = read_raw(self.path)
        self.assertEqual(self.call('/api/words'), (200, {'pending': [], 'approved': []}))
        self.assertEqual(read_raw(self.path), before)

    def test_add_trims_and_holds_back(self):
        origin = self.grammar()['origin']
        status, body = self.add('  the corner store remembers  ')
        self.assertEqual(status, 200)
        self.assertEqual(body['pending'], ['the corner store remembers'])
        g = self.grammar()
        self.assertEqual(g['participant_pending'], ['the corner store remembers'])
        self.assertEqual(g['participant'], [])
        self.assertEqual(g['origin'], origin)
        self.assertEqual(list(g)[-2:], ['participant', 'participant_pending'])

    def test_written_file_keeps_the_layout(self):
        self.add('café ✊ "quoted"\nsecond line')
        raw = read_raw(self.path)
        self.assertEqual(serve.dump_grammar(json.loads(raw)), raw)
        self.assertIn('café ✊', raw)
        self.assertFalse(raw.endswith('\n'))

    def test_duplicates_succeed_without_adding(self):
        self.add('same line')
        self.assertEqual(self.add('same line')[0], 200)
        self.call('/api/words/approve', {'text': 'same line'})
        self.assertEqual(self.add(' same line ')[0], 200)
        g = self.grammar()
        self.assertEqual((g['participant_pending'], g['participant']), ([], ['same line']))

    def test_refuses_empty_too_long_and_malformed(self):
        before = read_raw(self.path)
        for body in ({'text': '   '}, {'text': 'x' * 501}, {'text': 42}, {}, ['text']):
            self.assertEqual(self.call('/api/words', body)[0], 400, body)
        self.assertEqual(self.call('/api/words', raw_body=b'{not json')[0], 400)
        self.assertEqual(read_raw(self.path), before)
        self.assertEqual(self.add('x' * 500)[0], 200)

    def test_tracery_markup_becomes_look_alikes(self):
        self.add('#saveLou #nowhere [sic]')
        self.assertEqual(self.grammar()['participant_pending'], ['＃saveLou ＃nowhere ［sic］'])

    def test_approve_reject_unapprove(self):
        for text in ('one', 'two', 'three'):
            self.add(text)
        self.call('/api/words/approve', {'text': 'one'})
        self.call('/api/words/reject', {'text': 'two'})
        g = self.grammar()
        self.assertEqual((g['participant_pending'], g['participant']), (['three'], ['one']))
        self.assertEqual(g['origin'].count('#participant#'), 1)
        self.call('/api/words/approve', {'text': 'three'})
        self.assertEqual(self.grammar()['origin'].count('#participant#'), 1)
        status, body = self.call('/api/words/unapprove', {'text': 'one'})
        self.assertEqual((status, body['pending'], body['approved']), (200, ['one'], ['three']))

    def test_hand_repeated_reference_is_kept(self):
        self.add('one')
        self.call('/api/words/approve', {'text': 'one'})
        g = self.grammar()
        g['origin'].append('#participant#')
        with open(self.path, 'w', encoding='utf-8') as f:
            f.write(serve.dump_grammar(g))
        self.add('two')
        self.call('/api/words/approve', {'text': 'two'})
        self.assertEqual(self.grammar()['origin'].count('#participant#'), 2)

    def test_last_unapprove_drops_the_reference(self):
        self.add('only')
        self.call('/api/words/approve', {'text': 'only'})
        self.call('/api/words/unapprove', {'text': 'only'})
        g = self.grammar()
        self.assertEqual(g['participant'], [])
        self.assertNotIn('#participant#', g['origin'])

    def test_actions_on_missing_lines_change_nothing(self):
        self.add('here')
        before = read_raw(self.path)
        for action in ('approve', 'reject', 'unapprove'):
            self.assertEqual(self.call('/api/words/' + action, {'text': 'not here'})[0], 200)
        self.assertEqual(read_raw(self.path), before)

    def test_unknown_post_is_404(self):
        self.assertEqual(self.call('/api/nope', {'text': 'x'})[0], 404)

    def test_concurrent_adds_all_land(self):
        threads = [threading.Thread(target=self.add, args=('line %d' % i,)) for i in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(sorted(self.grammar()['participant_pending']), sorted('line %d' % i for i in range(20)))
        self.assertEqual([n for n in os.listdir(os.path.join(self.root, 'data')) if n.endswith('.tmp')], [])


if __name__ == '__main__':
    unittest.main()
