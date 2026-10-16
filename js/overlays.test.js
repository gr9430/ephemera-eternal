/**
 * overlays.test.js — Node.js test for the shape of data/overlays.json: the overlays offered in
 * the Overlays panel and laid over pages by Randomize. No DOM required.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { overlayElementFields } = require('./overlays.js');

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}

console.log('[data/overlays.json]');
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'overlays.json'), 'utf8'));
assert('is an array', Array.isArray(data));
assert(`has the grit pair and the Texturelabs papers (${data.length})`, data.length === 11);
const text = v => typeof v === 'string' && v.trim() !== '';
assert('every overlay has an id, src, label and alt', data.every(o => ['id', 'src', 'label', 'alt'].every(f => text(o[f]))));
assert('ids are unique', new Set(data.map(o => o.id)).size === data.length);
assert('every image is in overlays/ and exists', data.every(o => o.src.startsWith('overlays/') && fs.existsSync(path.join(root, o.src))));
assert('blend mode is multiply or normal', data.every(o => ['multiply', 'normal'].includes(o.blendMode)));
assert('opacity is between 0.05 and 1', data.every(o => typeof o.opacity === 'number' && o.opacity >= 0.05 && o.opacity <= 1));
assert('a credit comes with a provenance', data.every(o => !o.credit || text(o.provenance)));
assert('the Texturelabs papers are credited', data.filter(o => o.src.includes('Texturelabs')).every(o => /Texturelabs/.test(o.credit)));

console.log('[overlayElementFields]');
const fields = overlayElementFields(data.find(o => o.id === 'tl_paper_338'));
assert('takes the overlay\'s src, alt, blend mode and opacity', fields.src === 'overlays/Texturelabs_Paper_338L.png' &&
    fields.alt.startsWith('overlay: white streaks') && fields.blendMode === 'normal' && fields.opacity === 0.7);
const bare = overlayElementFields({ src: 'overlays/x.png', alt: 'x' });
assert('defaults: multiply at 30%', bare.blendMode === 'multiply' && bare.opacity === 0.3);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
