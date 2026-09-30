/**
 * clipart.test.js — Node.js tests for the pure logic in clipart.js and for the
 * shape of data/clipart.json. No DOM required.
 *
 * Manual-verify items (DOM/fetch only, untestable in Node):
 *   - Clipart.init()   — fetches data/clipart.json
 *   - Clipart.render() — builds .clipart-item DOM nodes, wires click-to-place
 *   - Clipart.place()  — loads the image to read its size, then adds an element
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { fitWithin, clipartTitle, validateClipart, CLIPART_START_MAX } = require('./clipart.js');

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

const valid = {
    id: 'a', src: 'images/clipart/a.png', alt: 'a thing',
    credit: 'Someone', provenance: 'own work'
};

console.log('[fitWithin]');
assert('scales a tall image to fit the box, keeping aspect ratio',
    eq(fitWithin(848, 1080, 200), { w: 157, h: 200 }));
assert('scales a wide image to fit the box',
    eq(fitWithin(1000, 500, 200), { w: 200, h: 100 }));
assert('never upscales a small image',
    eq(fitWithin(40, 30, 200), { w: 40, h: 30 }));
assert('falls back to a square box when a dimension is missing',
    eq(fitWithin(0, 0, 200), { w: 200, h: 200 }));
assert('CLIPART_START_MAX is 200', CLIPART_START_MAX === 200);

console.log('\n[clipartTitle]');
assert('credit alone when there is no source',
    clipartTitle({ credit: 'Jane', alt: 'x' }) === 'Jane');
assert('appends the source flyer when present',
    clipartTitle({ credit: 'Jane', alt: 'x', source: 'Show flyer 2018' }) === 'Jane — cut from Show flyer 2018');
assert('falls back to alt when credit is empty',
    clipartTitle({ credit: '', alt: 'a lamp' }) === 'a lamp');

console.log('\n[validateClipart]');
assert('a complete entry has no errors', validateClipart([valid]).length === 0);
assert('optional source and tags are allowed',
    validateClipart([Object.assign({}, valid, { source: 's', tags: ['lamp'] })]).length === 0);
assert('a missing required field is reported',
    validateClipart([Object.assign({}, valid, { alt: undefined })]).some(e => e.includes('alt')));
assert('a whitespace-only required field is reported',
    validateClipart([Object.assign({}, valid, { provenance: '   ' })]).some(e => e.includes('provenance')));
assert('duplicate ids are reported',
    validateClipart([valid, Object.assign({}, valid, { src: 'images/clipart/b.png' })]).some(e => e.includes('duplicate')));
assert('non-array tags are reported',
    validateClipart([Object.assign({}, valid, { tags: 'lamp' })]).some(e => e.includes('tags')));
assert('a non-array list is reported', validateClipart({}).length > 0);

console.log('\n[data/clipart.json]');
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'clipart.json'), 'utf8'));
const errors = validateClipart(data);
assert('every entry passes validateClipart' + (errors.length ? ' — ' + errors.join('; ') : ''),
    errors.length === 0);
data.forEach(piece => {
    assert('image file exists for ' + piece.id, fs.existsSync(path.join(root, piece.src)));
});

console.log('\n──────────────────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
