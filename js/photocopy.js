// photocopy.js — a Photocopy filter for photos, clip art and full-page photos, made to look like
// GIMP 3's Filters › Artistic › Photocopy, which the zines were made with. Every pixel is compared
// with the area around it: one clearly darker than its surroundings is toner (black), the rest is
// paper (white). CSS can't do this, so the editor shows (and the PDF prints) a processed copy of
// the picture, made once per picture and settings.
//
// This is the project's own code, not GIMP's or GEGL's: it was tuned by comparing its output with
// GIMP's (tests/browser/fixtures/gimp-photocopy-goldman.png).
//
// The steps, all on how light each pixel is (in linear light, where the comparison behaves like
// toner on paper):
//   detail  the picture blurred a little (less the higher Sharpness is)
//   area    the picture blurred a lot (Mask radius): what's around each pixel
//   ratio   detail ÷ area: under INK_LEVEL, the pixel is darker than its surroundings
// Percent black and Percent white let greys in either side of INK_LEVEL; at 0 and 1 the copy is
// pure black and white, as the zines use it. Then two things GIMP doesn't do: Solid black and
// Toner dots keep big dark areas dark (see photocopyShadows), and Bold lines keeps lines readable
// inside them.

// The zines' settings (the ones last used in GIMP), then the shadow fills and Bold lines
const PHOTOCOPY_DEFAULTS = { maskRadius: 16, sharpness: 0.5, black: 0, white: 1, solid: 0, dots: 0.5, bold: 1 };

const PHOTOCOPY_INK_LEVEL = 0.75;   // ratio under which a pixel is toner (matched to GIMP's output)
const PHOTOCOPY_GREY_SPAN = 0.25;   // how far either side of it Percent black/white spread their greys

// How much each slider blurs (standard deviations in pixels, matched to GIMP's output)
const photocopyAreaSigma = maskRadius => 0.3 + 0.3 * maskRadius;
const photocopyDetailSigma = sharpness => 0.3 + 3 * (1 - sharpness);

// 8×8 ordered-dither thresholds (Bayer): the toner dot pattern
const PHOTOCOPY_BAYER = [
    0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26,
    12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
    15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21
];
const PHOTOCOPY_DOT_GRID = 800;   // a picture is about this many dot cells across, whatever its size

// Gaussian blur of one channel. Near the edges only the pixels that exist count (their weights
// are rescaled to add up to 1), so the border doesn't darken or lighten.
function photocopyBlur(src, w, h, sigma) {
    if (sigma < 0.05) return Float32Array.from(src);
    const reach = Math.max(1, Math.ceil(sigma * 3));
    const weight = new Float32Array(reach + 1);
    for (let i = 0; i <= reach; i++) weight[i] = Math.exp(-(i * i) / (2 * sigma * sigma));
    // One pass along `lines` lines of `length` pixels; `along` steps within a line, `across` between lines
    const pass = (from, length, lines, along, across) => {
        const to = new Float32Array(from.length);
        for (let line = 0; line < lines; line++) {
            const start = line * across;
            for (let i = 0; i < length; i++) {
                const lo = Math.max(0, i - reach), hi = Math.min(length - 1, i + reach);
                let sum = 0, total = 0;
                for (let j = lo; j <= hi; j++) {
                    const k = weight[j > i ? j - i : i - j];
                    sum += from[start + j * along] * k;
                    total += k;
                }
                to[start + i * along] = sum / total;
            }
        }
        return to;
    };
    return pass(pass(src, w, h, 1, w), h, w, w, 1);
}

const photocopyLinear = v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const photocopyGamma = v => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
const photocopyClamp = v => (v < 0 ? 0 : v > 1 ? 1 : v);

// Photocopies RGBA pixels in place. Transparent parts count as white paper and keep their alpha.
// `scale` shrinks both blurs for a picture that was shrunk before processing.
function photocopyPixels(data, w, h, settings = {}) {
    const { maskRadius, sharpness, black, white, solid, dots, bold } = Object.assign({}, PHOTOCOPY_DEFAULTS, settings);
    const scale = settings.scale || 1;
    const shade = photocopyShade(data);
    const linear = new Float32Array(256);
    for (let v = 0; v < 256; v++) linear[v] = photocopyLinear(v / 255);
    // Luminance in linear light (Rec. 709), over white paper
    const tone = new Float32Array(w * h);
    for (let p = 0; p < tone.length; p++) {
        const i = p * 4, a = data[i + 3] / 255;
        tone[p] = (0.2126 * linear[data[i]] + 0.7152 * linear[data[i + 1]] + 0.0722 * linear[data[i + 2]]) * a + 1 - a;
    }
    const detail = photocopyBlur(tone, w, h, photocopyDetailSigma(sharpness) * scale);
    const area = photocopyBlur(tone, w, h, photocopyAreaSigma(maskRadius) * scale);
    const greyBelow = black * PHOTOCOPY_INK_LEVEL;     // 0: toner is solid black
    const greyAbove = (1 - white) * PHOTOCOPY_GREY_SPAN;  // 0: paper is pure white
    const ratios = detail;   // reused: each detail value is read once, just before its ratio replaces it
    for (let p = 0; p < tone.length; p++) {
        const ratio = area[p] > 0 ? detail[p] / area[p] : 1;
        let out;
        if (ratio < PHOTOCOPY_INK_LEVEL) {
            // Toner: black, or with Percent black a grey that fades in towards the ink level
            out = greyBelow ? detail[p] * photocopyClamp(1 - (PHOTOCOPY_INK_LEVEL - ratio) / greyBelow) : 0;
        } else {
            // Paper: white, or with Percent white the picture's own grey fading out to white
            const paper = greyAbove ? photocopyClamp((ratio - PHOTOCOPY_INK_LEVEL) / greyAbove) : 1;
            out = detail[p] + (1 - detail[p]) * paper;
        }
        const v = Math.round(photocopyGamma(photocopyClamp(out)) * 255);
        data[p * 4] = data[p * 4 + 1] = data[p * 4 + 2] = v;
        ratios[p] = ratio;
    }
    photocopyShadows(data, w, h, shade, ratios, { solid, dots, bold });
}

// How light each pixel of the original looks, 0-1 (sRGB luma; transparent parts are white paper)
function photocopyShade(data) {
    const shade = new Float32Array(data.length / 4);
    for (let i = 0, p = 0; p < shade.length; i += 4, p++) {
        const a = data[i + 3] / 255;
        shade[p] = ((0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255) * a + (1 - a);
    }
    return shade;
}

// Squared distance from every pixel to the nearest marked one: one pass along the rows, then one
// down the columns, each finding for every pixel the lowest of the parabolas (i - j)² + dist[j].
function photocopyDistance(mask, w, h) {
    const FAR = 1e12;
    const dist = new Float64Array(w * h);
    for (let p = 0; p < dist.length; p++) dist[p] = mask[p] ? 0 : FAR;
    const n = Math.max(w, h);
    const line = new Float64Array(n), from = new Int32Array(n), edge = new Float64Array(n + 1);
    const pass = (length, lines, along, across) => {
        for (let l = 0; l < lines; l++) {
            const start = l * across;
            for (let i = 0; i < length; i++) line[i] = dist[start + i * along];
            // The parabolas that are lowest somewhere, left to right; parabola k is lowest from edge[k] to edge[k + 1]
            let k = 0;
            from[0] = 0; edge[0] = -Infinity; edge[1] = Infinity;
            for (let i = 1; i < length; i++) {
                let meet;
                for (;;) {
                    const j = from[k];
                    meet = (line[i] + i * i - line[j] - j * j) / (2 * (i - j));
                    if (meet > edge[k]) break;
                    k--;
                }
                k++;
                from[k] = i; edge[k] = meet; edge[k + 1] = Infinity;
            }
            k = 0;
            for (let i = 0; i < length; i++) {
                while (edge[k + 1] < i) k++;
                const j = from[k];
                dist[start + i * along] = (i - j) * (i - j) + line[j];
            }
        }
    };
    pass(w, h, 1, w);
    pass(h, w, w, 1);
    return dist;
}

// Unmarks groups of touching marked pixels smaller than `least` pixels (specks, not lines)
function photocopyDropSpecks(mask, w, h, least) {
    const seen = new Uint8Array(mask.length), stack = [], group = [];
    for (let p0 = 0; p0 < mask.length; p0++) {
        if (!mask[p0] || seen[p0]) continue;
        stack.push(p0); seen[p0] = 1; group.length = 0;
        while (stack.length) {
            const p = stack.pop(), x = p % w, y = (p - x) / w;
            group.push(p);
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx, ny = y + dy, q = ny * w + nx;
                    if (nx >= 0 && nx < w && ny >= 0 && ny < h && mask[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
                }
            }
        }
        if (group.length < least) for (const p of group) mask[p] = 0;
    }
    return mask;
}

// Photocopy only draws edges, so a big even dark area (a face in shadow, dark skin) comes out
// white. Not in GIMP: areas of the original darker than `dots` become toner dots as dense as the
// original is dark, and darker than `solid` go solid black. 0 turns either off.
// Lines inside those areas would be lost among the dots, so Bold lines (`bold` dot cells) looks
// for them a little harder there (a ratio under PHOTOCOPY_BOLD_LEVEL), drops specks, thickens
// what's left and clears a round white rim around it, as an engraver would.
const PHOTOCOPY_BOLD_LEVEL = 0.88;
const PHOTOCOPY_SPECK = 12;   // groups smaller than this many dot cells are specks
function photocopyShadows(data, w, h, shade, ratios, { solid, dots, bold }) {
    if (!solid && !dots) return;
    const cell = Math.max(1, Math.round(Math.max(w, h) / PHOTOCOPY_DOT_GRID));
    const level = Math.max(solid, dots);
    let near = null, thick = 0, rim = 0;
    if (bold) {
        const lines = new Uint8Array(w * h);
        for (let p = 0; p < lines.length; p++) {
            lines[p] = data[p * 4] < 128 || (shade[p] < level && ratios[p] < PHOTOCOPY_BOLD_LEVEL) ? 1 : 0;
        }
        near = photocopyDistance(photocopyDropSpecks(lines, w, h, PHOTOCOPY_SPECK * cell * cell), w, h);
        thick = (bold * cell) ** 2;
        rim = (2 * bold * cell) ** 2;
    }
    for (let p = 0; p < shade.length; p++) {
        const light = shade[p];
        if (light >= level) continue;
        let ink;   // otherwise what the copy drew stays: lines are never covered up
        if (near && near[p] <= thick) {
            ink = true;
        } else if (near && near[p] <= rim) {
            data[p * 4] = data[p * 4 + 1] = data[p * 4 + 2] = 255;
            continue;
        } else if (light < solid) {
            ink = true;
        } else {
            const x = Math.floor((p % w) / cell) % 8, y = Math.floor(Math.floor(p / w) / cell) % 8;
            ink = light <= (PHOTOCOPY_BAYER[y * 8 + x] + 0.5) / 64;
        }
        if (ink) data[p * 4] = data[p * 4 + 1] = data[p * 4 + 2] = 0;
    }
}

// The copy is made at the picture's own resolution, so the radii mean what they mean in GIMP on
// that file. A bigger file is shrunk to PHOTOCOPY_MAX_SIDE with the radii shrunk to match.
const PHOTOCOPY_MAX_SIDE = 2400;

const Photocopy = {
    cache: new Map(),   // key → { promise, url } (url null when the picture can't be read back)

    settings: function (element) {
        return {
            maskRadius: element.photocopyMaskRadius ?? PHOTOCOPY_DEFAULTS.maskRadius,
            sharpness: element.photocopySharpness ?? PHOTOCOPY_DEFAULTS.sharpness,
            black: element.photocopyBlack ?? PHOTOCOPY_DEFAULTS.black,
            white: element.photocopyWhite ?? PHOTOCOPY_DEFAULTS.white,
            solid: element.photocopySolid ?? PHOTOCOPY_DEFAULTS.solid,
            dots: element.photocopyDots ?? PHOTOCOPY_DEFAULTS.dots,
            bold: element.photocopyBold ?? PHOTOCOPY_DEFAULTS.bold
        };
    },

    // Promise of a data URL of the picture photocopied; null if it can't be read back
    make: function (src, settings) {
        const key = [src, settings.maskRadius, settings.sharpness, settings.black, settings.white, settings.solid, settings.dots, settings.bold].join('|');
        if (!Photocopy.cache.has(key)) {
            const entry = { url: undefined };
            entry.promise = (async () => {
                const img = new Image();
                img.src = src;
                await img.decode();
                const scale = Math.min(1, PHOTOCOPY_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
                canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
                photocopyPixels(pixels.data, canvas.width, canvas.height, Object.assign({ scale }, settings));
                ctx.putImageData(pixels, 0, 0);
                return canvas.toDataURL('image/png');
            })().catch(() => null).then(url => (entry.url = url));
            Photocopy.cache.set(key, entry);
        }
        return Photocopy.cache.get(key);
    },

    // Shows an element's picture in `img` with its Color setting: a CSS filter, or for Photocopy the
    // processed copy (plain grey until it's ready). img.photocopyReady settles once it shows.
    apply: function (img, element) {
        img.photocopyReady = null;
        if (element.filter === 'photocopy') {
            const entry = Photocopy.make(element.src, Photocopy.settings(element));
            const show = url => {
                if (url) img.src = url;   // a picture from another site stays plain grey
                else img.style.filter = 'grayscale(1)';
            };
            if (entry.url !== undefined) {
                show(entry.url);
            } else {
                img.style.filter = 'grayscale(1)';
                img.photocopyReady = entry.promise.then(url => {
                    if (url) img.style.filter = 'none';
                    show(url);
                    return img.decode().catch(() => {});
                });
            }
        } else if (element.filter && element.filter !== 'none') {
            img.style.filter = element.filter;
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { photocopyPixels, PHOTOCOPY_DEFAULTS };
}
