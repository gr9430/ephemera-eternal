/**
 * photocopy.test.js — Node.js test for photocopyPixels in photocopy.js (GIMP 3's Photocopy, GEGL's
 * gegl:photocopy). How close it comes to GIMP's own output is checked in
 * tests/browser/photocopy.cjs against a picture GIMP made. No DOM required.
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
// GIMP's own behaviour is tested with the shadow fills off; the Shadows section turns them on
const copy = (data, opts) => { const d = Uint8ClampedArray.from(data); photocopyPixels(d, W, H, Object.assign({ solid: 0, dots: 0 }, opts)); return d; };
const count = (data, test) => { let n = 0; for (let i = 0; i < data.length; i += 4) if (test(data[i])) n++; return n; };
const greys = d => count(d, v => v > 0 && v < 255);

// Dark marks on a light, slightly coloured ground with a soft gradient: something like a photo
const scene = picture((x, y) => {
    if (x > 25 && x < 55 && y > 25 && y < 55) return [60, 40, 30];
    if ((x + y) % 17 < 4) return [90, 80, 70];
    return [200 + x / 4, 180 + y / 4, 150];
});

console.log('[defaults]');
assert('mask radius 16, sharpness 0.5, black 0, white 1; toner dots under 0.5, solid black off', JSON.stringify(PHOTOCOPY_DEFAULTS) ===
    JSON.stringify({ maskRadius: 16, sharpness: 0.5, black: 0, white: 1, solid: 0, dots: 0.5 }));

console.log('[black 0, white 1: pure black and white]');
const out = copy(scene);
let grey = true;
for (let i = 0; i < out.length; i += 4) if (out[i] !== out[i + 1] || out[i] !== out[i + 2]) grey = false;
assert('every pixel is grey', grey);
assert('every pixel is pure black or white', greys(out) === 0);
assert('the flat ground goes white', at(out, 70, 5) === 255);
assert('the edge of the square goes black', at(out, 27, 40) === 0);
assert('the thin lines go black', at(out, 12, 6) === 0);   // x + y = 18: on a line

console.log('[a flat picture]');
// GEGL: with nothing darker than its surroundings there's no white ramp to measure, so it comes out pale
assert('has no black (no edges to draw)', count(copy(picture(() => [120, 120, 120])), v => v < 128) === 0);

console.log('[transparency]');
const art = copy(picture((x, y) => (x > 30 && x < 50) ? [0, 0, 0, 255] : [0, 0, 0, 0]));
assert('alpha is kept', art[3] === 0 && art[(40 * W + 40) * 4 + 3] === 255);
assert('transparent parts are white paper', at(art, 5, 5) === 255);
assert('the edge of the black bar goes black', at(art, 32, 40) === 0);

console.log('[Percent black and Percent white]');
assert('Percent black above 0 softens the black into greys', greys(copy(scene, { black: 0.2 })) > 0);
assert('Percent white under 1 softens the white into greys', greys(copy(scene, { white: 0.2 })) > 0);

console.log('[Mask radius and Sharpness]');
const blacks = opts => count(copy(scene, opts), v => v === 0);
assert('a bigger mask radius, more black', blacks({ maskRadius: 30 }) > blacks({ maskRadius: 5 }));
const soft = copy(scene, { sharpness: 0 }), sharp = copy(scene, { sharpness: 1 });
assert('sharpness changes the picture', soft.some((v, i) => v !== sharp[i]));
const shrunk = copy(scene, { scale: 0.5 });
assert('scale shrinks the radii (for a shrunk picture)', shrunk.some((v, i) => v !== out[i]));

console.log('[Shadows: Solid black and Toner dots]');
// A big even dark patch (a face in shadow, dark skin) on a light ground: GIMP's Photocopy turns it white
const patch = picture((x, y) => (x >= 10 && x < 70 && y >= 10 && y < 70) ? [80, 60, 50] : [225, 220, 210]);
const inside = d => { let black = 0, n = 0; for (let y = 25; y < 55; y++) for (let x = 25; x < 55; x++) { n++; if (at(d, x, y) === 0) black++; } return black / n; };
assert(`both off: the patch washes out to white, as in GIMP (${inside(copy(patch)).toFixed(2)} black)`, inside(copy(patch)) === 0);
const solid = copy(patch, { solid: 0.5 });
assert('Solid black: the patch is filled black', inside(solid) === 1);
assert('Solid black: the light ground stays white', at(solid, 3, 3) === 255);
const dots = copy(patch, { dots: 0.5 });
assert(`Toner dots: the patch keeps its tone (${inside(dots).toFixed(2)} black; the original is ~0.73 dark)`, inside(dots) > 0.6 && inside(dots) < 0.85);
assert('Toner dots: still pure black and white', greys(dots) === 0);
assert('Toner dots: the light ground stays white', at(dots, 3, 3) === 255);
assert('a patch lighter than the level is left alone', inside(copy(patch, { solid: 0.2, dots: 0.2 })) === 0);
// Two tones: the deepest shadow under Solid black's level, a mid-dark under Toner dots' only
const tones = picture((x, y) => x < 10 || x >= 70 || y < 10 || y >= 70 ? [225, 220, 210] : x < 40 ? [30, 25, 20] : [110, 100, 95]);
const both = copy(tones, { solid: 0.2, dots: 0.6 });
const share = (d, x0, x1) => { let black = 0, n = 0; for (let y = 25; y < 55; y++) for (let x = x0; x < x1; x++) { n++; if (at(d, x, y) === 0) black++; } return black / n; };
assert('together: the deepest shadow is solid black', share(both, 15, 35) === 1);
assert(`together: the mid-dark is toner dots (${share(both, 45, 65).toFixed(2)} black)`, share(both, 45, 65) > 0.3 && share(both, 45, 65) < 0.8);
const plain = Uint8ClampedArray.from(patch); photocopyPixels(plain, W, H);
assert('Toner dots are on by default', inside(plain) === inside(dots));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
