/**
 * photos.test.js — Node.js tests for the pure logic in photos.js and for the
 * shape of data/photos.json. No DOM required.
 *
 * Manual-verify items (DOM/fetch only, untestable in Node):
 *   - Photos.init()   — fetches data/photos.json
 *   - Photos.render() — builds .clipart-item DOM nodes, wires click-to-place
 *   - Photos.place()  — loads the image to read its size, then adds an element
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { photoTitle } = require('./photos.js');

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}

console.log('[photoTitle]');
assert('returns the credit', photoTitle({ credit: 'Adam Goldman', alt: 'x' }) === 'Adam Goldman');
assert('falls back to alt when credit is empty', photoTitle({ credit: '', alt: 'a wall' }) === 'a wall');

console.log('\n[data/photos.json]');
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'photos.json'), 'utf8'));
assert('is an array', Array.isArray(data));
assert('has 33 entries', data.length === 33);

const required = ['id', 'src', 'alt', 'credit', 'provenance'];
const seen = new Set();
let missingField = false;
let dup = false;
data.forEach(photo => {
    required.forEach(field => {
        if (typeof photo[field] !== 'string' || !photo[field].trim()) missingField = true;
    });
    if (seen.has(photo.id)) dup = true;
    seen.add(photo.id);
});
assert('every entry has id/src/alt/credit/provenance', !missingField);
assert('no duplicate ids', !dup);
assert('every entry is credited to Adam Goldman', data.every(p => p.credit === 'Adam Goldman'));
assert('every entry is marked co-presenter, permission granted',
    data.every(p => p.provenance === 'co-presenter, permission granted'));

data.forEach(photo => {
    assert('image file exists for ' + photo.id, fs.existsSync(path.join(root, photo.src)));
});

console.log('\n──────────────────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
