// photocopy.js — GIMP 3's Filters › Artistic › Photocopy (GEGL's gegl:photocopy), for photos, clip
// art and full-page photos. In linear light, each pixel (lightly blurred by Sharpness) is compared
// with the average of the area around it (Mask radius): clearly darker than its surroundings goes
// black, otherwise white. Percent black and Percent white soften those into grey ramps, exactly as
// GEGL does. CSS can't do this, so the editor shows (and the PDF prints) a processed copy of the
// picture, made once per picture and settings.
//
// The filter is a port of GEGL's operations/common-gpl3+/photocopy.c (GPL-3.0-or-later;
// © 2001 Spencer Kimball, Bit Specialists, Inc.; © 2011 Hans Lo), so this file is GPL-3.0-or-later too.

// Defaults are the settings last used in GIMP for the zines (GEGL's own: 10, 0.5, 0.2, 0.2), plus
// the shadow fills, which aren't GIMP's (see photocopyShadows): Toner dots on, Solid black off.
const PHOTOCOPY_DEFAULTS = { maskRadius: 16, sharpness: 0.5, black: 0, white: 1, solid: 0, dots: 0.5 };
const PHOTOCOPY_THRESHOLD = 0.75;

// 8×8 ordered-dither thresholds (Bayer): the toner dot pattern
const PHOTOCOPY_BAYER = [
    0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26,
    12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
    15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21
];
const PHOTOCOPY_DOT_GRID = 800;   // a picture is about this many dot cells across, whatever its size

// GEGL turns a radius into the standard deviation whose Gaussian falls to 1/255 at that radius
function photocopyStdDev(radius) {
    radius = Math.abs(radius) + 1;
    return Math.sqrt(-(radius * radius) / (2 * Math.log(1 / 255)));
}

// Separable Gaussian blur of a single-channel float image, edges clamped (gegl:gaussian-blur)
function photocopyBlur(src, w, h, stdDev) {
    const reach = Math.ceil(stdDev * 3);
    const kernel = [];
    let total = 0;
    for (let i = -reach; i <= reach; i++) {
        const k = Math.exp(-(i * i) / (2 * stdDev * stdDev));
        kernel.push(k);
        total += k;
    }
    for (let i = 0; i < kernel.length; i++) kernel[i] /= total;
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
            let sum = 0;
            for (let i = -reach; i <= reach; i++) sum += src[row + Math.min(w - 1, Math.max(0, x + i))] * kernel[i + reach];
            tmp[row + x] = sum;
        }
    }
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let sum = 0;
            for (let i = -reach; i <= reach; i++) sum += tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x] * kernel[i + reach];
            out[y * w + x] = sum;
        }
    }
    return out;
}

// GEGL's compute_ramp + calculate_threshold, as written there: only darkened pixels (ratio under
// the threshold) are counted, so the black ramp is 0 (solid black) when Percent black is 0 and
// 1 otherwise, and the white ramp comes from the spread of the darkened pixels.
function photocopyRamps(sharp, mask, black, white) {
    const hist = new Uint32Array(2000);
    let count = 0;
    for (let i = 0; i < sharp.length; i++) {
        const diff = sharp[i] / mask[i];
        if (diff < PHOTOCOPY_THRESHOLD && diff >= 0) {
            hist[Math.floor(diff * 1000)]++;
            count++;
        }
    }
    const rampDown = black === 0 || count === 0 ? 0 : 1;
    let rampUp = 0;
    if (white === 0 || count === 0) {
        rampUp = 1;
    } else {
        let sum = 0;
        for (let i = 0; i < 2000; i++) {
            sum += hist[i];
            if (sum / count > white) {
                rampUp = PHOTOCOPY_THRESHOLD - i / 1000;
                break;
            }
        }
    }
    return { rampDown, rampUp };
}

const srgbToLinear = v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const linearToSrgb = v => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

// Photocopies RGBA pixels in place. Transparent parts count as white paper and keep their alpha.
// `scale` shrinks both blurs for a picture that was shrunk before processing.
function photocopyPixels(data, w, h, {
    maskRadius = PHOTOCOPY_DEFAULTS.maskRadius, sharpness = PHOTOCOPY_DEFAULTS.sharpness,
    black = PHOTOCOPY_DEFAULTS.black, white = PHOTOCOPY_DEFAULTS.white,
    solid = PHOTOCOPY_DEFAULTS.solid, dots = PHOTOCOPY_DEFAULTS.dots, scale = 1
} = {}) {
    const shade = photocopyShade(data);
    const toLinear = new Float32Array(256);
    for (let v = 0; v < 256; v++) toLinear[v] = srgbToLinear(v / 255);
    // "Y float": linear luminance (babl's sRGB weights)
    const light = new Float32Array(w * h);
    for (let i = 0, p = 0; p < light.length; i += 4, p++) {
        const a = data[i + 3] / 255;
        const y = 0.2225045 * toLinear[data[i]] + 0.7168786 * toLinear[data[i + 1]] + 0.0606169 * toLinear[data[i + 2]];
        light[p] = y * a + (1 - a);
    }
    const sharp = photocopyBlur(light, w, h, photocopyStdDev(Math.max(1, 10 * (1 - sharpness))) * scale);
    const mask = photocopyBlur(light, w, h, photocopyStdDev(maskRadius) * scale);
    const { rampDown, rampUp } = photocopyRamps(sharp, mask, black, white);
    for (let i = 0, p = 0; p < light.length; i += 4, p++) {
        const diff = sharp[p] / mask[p];
        let out;
        if (diff < PHOTOCOPY_THRESHOLD) {
            out = rampDown === 0 ? 0 : sharp[p] * (rampDown - Math.min(rampDown, PHOTOCOPY_THRESHOLD - diff)) / rampDown;
        } else {
            const mult = rampUp === 0 ? 1 : Math.min(rampUp, diff - PHOTOCOPY_THRESHOLD) / rampUp;
            out = mult + sharp[p] - mult * sharp[p];
        }
        out = Math.max(0, Math.min(1, out));
        data[i] = data[i + 1] = data[i + 2] = Math.round(linearToSrgb(out) * 255);
    }
    photocopyShadows(data, w, h, shade, solid, dots);
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

// Photocopy only draws edges, so a big even dark area (a face in shadow, dark skin) comes out
// white. Not in GIMP: areas of the original darker than `dots` become toner dots as dense as the
// original is dark, and darker than `solid` go solid black. 0 turns either off. Lines stay on top.
function photocopyShadows(data, w, h, shade, solid, dots) {
    if (!solid && !dots) return;
    const cell = Math.max(1, Math.round(Math.max(w, h) / PHOTOCOPY_DOT_GRID));
    for (let p = 0; p < shade.length; p++) {
        const light = shade[p];
        let ink = false;
        if (light < solid) {
            ink = true;
        } else if (light < dots) {
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
            dots: element.photocopyDots ?? PHOTOCOPY_DEFAULTS.dots
        };
    },

    // Promise of a data URL of the picture photocopied; null if it can't be read back
    make: function (src, settings) {
        const key = [src, settings.maskRadius, settings.sharpness, settings.black, settings.white, settings.solid, settings.dots].join('|');
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
