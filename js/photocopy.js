// photocopy.js — GIMP's Filters › Artistic › Photocopy, for photos, clip art and full-page photos.
// Each pixel is compared with the average of the area around it: clearly darker than its
// surroundings goes black, otherwise white, with a short grey ramp between. Darkness is GIMP's
// "percent black" and Sharpness its "sharpness"; the mask radius stays at GIMP's 8 px (see
// PHOTOCOPY_SCALE for the size it's measured at). CSS can't do this, so the editor shows
// (and the PDF prints) a processed copy of the picture, made once per picture and settings.

const PHOTOCOPY_DEFAULTS = { darkness: 0.2, sharpness: 0.8 };
const PHOTOCOPY_MASK_RADIUS = 8;
const PHOTOCOPY_WHITE = 0.2;   // GIMP's "percent white"
const PHOTOCOPY_THRESHOLD = 0.75;
const PHOTOCOPY_EPSILON = 2;   // surroundings this dark print black

// GIMP turns a radius into the standard deviation whose Gaussian falls to 1/255 at that radius
function photocopyStdDev(radius) {
    radius = Math.abs(radius) + 1;
    return Math.sqrt(-(radius * radius) / (2 * Math.log(1 / 255)));
}

// Separable Gaussian blur of a single-channel float image, edges clamped
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

// GIMP's compute_ramp: how wide the black (under the threshold) or white ramp is, from the
// spread of pixel-to-surroundings ratios, so that about `pct` of them land in solid black/white
function photocopyRamp(sharp, mask, pct, underThreshold) {
    const hist = new Uint32Array(2000);
    let count = 0;
    for (let i = 0; i < sharp.length; i++) {
        if (mask[i] === 0) continue;
        const diff = sharp[i] / mask[i];
        if (underThreshold ? diff < PHOTOCOPY_THRESHOLD : diff >= PHOTOCOPY_THRESHOLD && diff < 2) {
            hist[Math.floor(diff * 1000)]++;
            count++;
        }
    }
    if (pct === 0 || count === 0) return underThreshold ? 1 : 0;
    let sum = 0;
    for (let i = 0; i < 2000; i++) {
        sum += hist[i];
        if (sum / count > pct) return underThreshold ? PHOTOCOPY_THRESHOLD - i / 1000 : i / 1000 - PHOTOCOPY_THRESHOLD;
    }
    return underThreshold ? 0 : 1;
}

// Photocopies RGBA pixels in place. Transparent parts count as white paper and keep their alpha.
function photocopyPixels(data, w, h, { darkness = PHOTOCOPY_DEFAULTS.darkness, sharpness = PHOTOCOPY_DEFAULTS.sharpness } = {}) {
    const light = new Float32Array(w * h);
    for (let i = 0, p = 0; p < light.length; i += 4, p++) {
        const a = data[i + 3] / 255;
        light[p] = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) * a + 255 * (1 - a);
    }
    const sharp = photocopyBlur(light, w, h, photocopyStdDev(Math.max(1, 10 * (1 - sharpness))));
    const mask = photocopyBlur(light, w, h, photocopyStdDev(PHOTOCOPY_MASK_RADIUS));
    const rampDown = photocopyRamp(sharp, mask, darkness, true);
    const rampUp = photocopyRamp(sharp, mask, 1 - PHOTOCOPY_WHITE, false);
    for (let i = 0, p = 0; p < light.length; i += 4, p++) {
        let value = 0;
        if (mask[p] > PHOTOCOPY_EPSILON) {
            const diff = sharp[p] / mask[p];
            if (diff < PHOTOCOPY_THRESHOLD) {
                const mult = rampDown === 0 ? 0 : (rampDown - Math.min(rampDown, PHOTOCOPY_THRESHOLD - diff)) / rampDown;
                value = sharp[p] * mult;
            } else {
                const mult = rampUp === 0 ? 1 : Math.min(rampUp, diff - PHOTOCOPY_THRESHOLD) / rampUp;
                value = 255 - (1 - mult) * (255 - sharp[p]);
            }
        }
        data[i] = data[i + 1] = data[i + 2] = Math.max(0, Math.min(255, Math.round(value)));
    }
}

// The photocopied copy is made at about print resolution for the picture's size on the page
// (3 × its page size, roughly 300 dpi), so the 8 px mask looks the same however big the source
// file is. Sizes are rounded to 50 px steps so resizing a picture doesn't remake it every pixel.
const PHOTOCOPY_SCALE = 3;
const PHOTOCOPY_MAX_SIDE = 2400;

const Photocopy = {
    cache: new Map(),   // key → { promise, url } (url null when the picture can't be read back)

    settings: function (element) {
        return {
            darkness: element.photocopyDarkness ?? PHOTOCOPY_DEFAULTS.darkness,
            sharpness: element.photocopySharpness ?? PHOTOCOPY_DEFAULTS.sharpness
        };
    },

    // Promise of a data URL of the picture photocopied, its longer side `side` px; null if it can't be
    make: function (src, side, settings) {
        const key = [src, side, settings.darkness, settings.sharpness].join('|');
        if (!Photocopy.cache.has(key)) {
            const entry = { url: undefined };
            entry.promise = (async () => {
                const img = new Image();
                img.src = src;
                await img.decode();
                const scale = side / Math.max(img.naturalWidth, img.naturalHeight);
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
                canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
                photocopyPixels(pixels.data, canvas.width, canvas.height, settings);
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
            const side = Math.min(PHOTOCOPY_MAX_SIDE, Math.max(50, Math.round(Math.max(element.w, element.h) * PHOTOCOPY_SCALE / 50) * 50));
            const entry = Photocopy.make(element.src, side, Photocopy.settings(element));
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
