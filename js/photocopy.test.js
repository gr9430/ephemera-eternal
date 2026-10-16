/**
 * photocopy.test.js — Node.js test for photocopyPixels in photocopy.js (GIMP's Photocopy filter).
 * No DOM required.
 */

'use strict';

const { photocopyPixels, PHOTOCOPY_DEFAULTS } = require('./photocopy.js');

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}

const W = 80, H = 80;
// An RGBA picture from a function of (x, y) giving [r, g, b] or [r, g, b, a]
function picture(fn) {
    const data = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const [r, g, b, a = 255] = fn(x, y);
            data.set([r, g, b, a], (y * W + x) * 4);
        }
    }
    return data;
}
const at = (data, x, y) => data[(y * W + x) * 4];
const copy = (data, opts) => { const d = Uint8ClampedArray.from(data); photocopyPixels(d, W, H, opts); return d; };
const count = (data, test) => { let n = 0; for (let i = 0; i < data.length; i += 4) if (test(data[i])) n++; return n; };

// A dark square on a light, slightly coloured ground with a soft gradient: something like a photo
const scene = picture((x, y) => (x > 25 && x < 55 && y > 25 && y < 55) ? [60, 40, 30] : [200 + x / 4, 180 + y / 4, 150]);

console.log('[defaults]');
assert('darkness 0.2, sharpness 0.8 (GIMP\'s)', PHOTOCOPY_DEFAULTS.darkness === 0.2 && PHOTOCOPY_DEFAULTS.sharpness === 0.8);

console.log('[grey, black and white]');
const out = copy(scene);
let grey = true;
for (let i = 0; i < out.length; i += 4) if (out[i] !== out[i + 1] || out[i] !== out[i + 2]) grey = false;
assert('every pixel is grey', grey);
assert('the flat ground goes white', at(out, 5, 5) >= 245 && at(out, 70, 70) >= 245);
assert('the edge of the square goes black', at(out, 27, 40) <= 10);
assert('mostly pure black or white', count(out, v => v <= 10 || v >= 245) > W * H * 0.9);

console.log('[a flat picture]');
const flat = copy(picture(() => [120, 120, 120]));
assert('is all white (no edges to draw)', count(flat, v => v >= 245) === W * H);

console.log('[transparency]');
const art = copy(picture((x, y) => (x > 30 && x < 50) ? [0, 0, 0, 255] : [0, 0, 0, 0]));
assert('alpha is kept', art[3] === 0 && art[(40 * W + 40) * 4 + 3] === 255);
assert('the line stays dark', at(art, 33, 40) <= 10 && at(art, 40, 40) <= 10);

console.log('[the sliders]');
const blacks = opts => count(copy(scene, opts), v => v <= 10);
assert('more darkness, more black', blacks({ darkness: 0.6, sharpness: 0.8 }) > blacks({ darkness: 0.2, sharpness: 0.8 }));
assert('less darkness, less black', blacks({ darkness: 0.05, sharpness: 0.8 }) < blacks({ darkness: 0.2, sharpness: 0.8 }));
const soft = copy(scene, { darkness: 0.2, sharpness: 0 }), sharp = copy(scene, { darkness: 0.2, sharpness: 1 });
assert('sharpness changes the picture', soft.some((v, i) => v !== sharp[i]));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
