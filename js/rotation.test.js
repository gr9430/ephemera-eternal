/**
 * rotation.test.js — Node.js test for screenToSheet in store.js (view rotation maths).
 * Loads the real booklet.js + store.js into a sandbox. No DOM required.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}

const sandbox = { Date, Math, JSON, Object, Array };
vm.createContext(sandbox);
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
vm.runInContext(read('booklet.js') + '\n' + read('store.js') + '\nthis.screenToSheet = screenToSheet; this.state = state;', sandbox);
const { screenToSheet } = sandbox;
const W = 1056, H = 816;
const at = (dx, dy, r) => { const p = screenToSheet(dx, dy, r, W, H); return `${p.x},${p.y}`; };

console.log('[centre maps to centre]');
assert('every angle', [0, 90, 180, 270].every(r => at(0, 0, r) === `${W / 2},${H / 2}`));

console.log('[moving right on screen]');
assert('0°: right on the sheet', at(10, 0, 0) === `${W / 2 + 10},${H / 2}`);
assert('90°: up on the sheet', at(10, 0, 90) === `${W / 2},${H / 2 - 10}`);
assert('180°: left on the sheet', at(10, 0, 180) === `${W / 2 - 10},${H / 2}`);
assert('270°: down on the sheet', at(10, 0, 270) === `${W / 2},${H / 2 + 10}`);

console.log('[moving down on screen]');
assert('90°: right on the sheet', at(0, 10, 90) === `${W / 2 + 10},${H / 2}`);
assert('180°: up on the sheet', at(0, 10, 180) === `${W / 2},${H / 2 - 10}`);

console.log('[screen corner of a 90° sheet is the sheet\'s top-left]');
// At 90° clockwise the sheet's top-left corner is drawn at the screen box's top-right
assert('top-right of the rotated box', at(H / 2, -W / 2, 90) === '0,0');

console.log('[state]');
assert('viewRotation starts at 0', sandbox.state.viewRotation === 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
