/**
 * mode.test.js — Node.js test for readMode() in mode.js: ?workshop turns on the workshop, and
 * ?opening-night / ?organizer only count together with it.
 */

'use strict';

const { readMode } = require('./mode.js');

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}

const is = (search, workshop, openingNight, organizer) => {
    const m = readMode(search);
    return m.workshop === workshop && m.openingNight === openingNight && m.organizer === organizer;
};

console.log('[flags]');
assert('plain URL is the public version', is('', false, false, false));
assert('?workshop', is('?workshop', true, false, false));
assert('?workshop&opening-night', is('?workshop&opening-night', true, true, false));
assert('?workshop&organizer', is('?workshop&organizer', true, false, true));
assert('order does not matter', is('?opening-night&workshop', true, true, false));
assert('all three', is('?workshop&opening-night&organizer', true, true, true));
assert('?workshop=1 still counts', is('?workshop=1', true, false, false));
assert('a bare ?organizer does nothing', is('?organizer', false, false, false));
assert('a bare ?opening-night does nothing', is('?opening-night', false, false, false));
assert('unrelated flags do nothing', is('?workshops&organiser', false, false, false));

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
