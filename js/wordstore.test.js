/**
 * wordstore.test.js — Node.js test for the pure helpers in wordstore.js (entries, approval,
 * the approved-words export). The IndexedDB part is covered by the browser checks.
 */

'use strict';

const W = require('./wordstore.js');

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}

const t1 = new Date(2026, 9, 2, 14, 30);
const t2 = new Date(2026, 9, 3, 9, 5);

console.log('[entries]');
{
    const e = W.makeWordEntry('  the corner store remembers  ', t1, 'a1');
    assert('trimmed text, pending, stamped', e.text === 'the corner store remembers' && e.status === 'pending' && e.addedAt === t1.toISOString() && e.id === 'a1');
    const ok = W.approveWordEntry(e, t2);
    assert('approve stamps approvedAt', ok.status === 'approved' && ok.approvedAt === t2.toISOString() && ok.text === e.text);
    assert('approve leaves the original alone', e.status === 'pending' && !('approvedAt' in e));
    const back = W.unapproveWordEntry(ok);
    assert('undo returns to pending without approvedAt', back.status === 'pending' && !('approvedAt' in back));
}

console.log('[export]');
{
    const entries = [
        W.approveWordEntry(W.makeWordEntry('kept', t1, 'a'), t2),
        W.makeWordEntry('still pending', t1, 'b')
    ];
    const file = W.approvedWordsFile(entries, t2);
    assert('file shape', file.app === 'zine-workshop' && file.kind === 'approved-words' && file.exportedAt === t2.toISOString());
    assert('only approved words, with their dates', file.words.length === 1 && file.words[0].text === 'kept' &&
        file.words[0].addedAt === t1.toISOString() && file.words[0].approvedAt === t2.toISOString() && !('id' in file.words[0]));
    assert('file name uses the local date', W.approvedWordsFileName(t2) === 'approved-words-2026-10-03.json');
    assert('empty list exports an empty words array', W.approvedWordsFile([], t2).words.length === 0);
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
