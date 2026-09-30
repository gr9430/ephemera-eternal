// clipart.js — pre-cut collage pieces panel.
// Pieces are prepared ahead of time (transparent PNGs listed in data/clipart.json);
// there is no in-app cutting and no upload.

const CLIPART_REQUIRED = ['id', 'src', 'alt', 'credit', 'provenance'];
const CLIPART_START_MAX = 200;   // starting bounding box (canvas px) for a placed piece

function fitWithin(w, h, max) {
    if (!w || !h) return { w: max, h: max };
    const scale = Math.min(1, max / w, max / h);
    return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

function clipartTitle(piece) {
    const base = piece.credit || piece.alt;
    return piece.source ? base + ' — cut from ' + piece.source : base;
}

function validateClipart(list) {
    if (!Array.isArray(list)) return ['clipart.json must be an array'];
    const errors = [];
    const seen = new Set();
    list.forEach((piece, i) => {
        const label = 'entry ' + i + (piece && piece.id ? ' (' + piece.id + ')' : '');
        CLIPART_REQUIRED.forEach(field => {
            const value = piece && piece[field];
            if (typeof value !== 'string' || !value.trim()) {
                errors.push(label + ': missing required field "' + field + '"');
            }
        });
        if (piece && piece.tags !== undefined && !Array.isArray(piece.tags)) {
            errors.push(label + ': "tags" must be an array');
        }
        if (piece && piece.id) {
            if (seen.has(piece.id)) errors.push(label + ': duplicate id');
            seen.add(piece.id);
        }
    });
    return errors;
}

const Clipart = {
    init: function () {
        fetch('data/clipart.json')
            .then(r => r.json())
            .then(data => {
                state.clipartImages = data;
                this.render();
            })
            .catch(() => {
                state.clipartImages = [];
                this.render();
            });
    },

    render: function () {
        const container = document.getElementById('clipart-gallery');
        container.innerHTML = '';
        (state.clipartImages || []).forEach(piece => {
            const item = document.createElement('div');
            item.className = 'clipart-item';
            item.title = clipartTitle(piece);

            const img = document.createElement('img');
            img.className = 'clipart-thumb';
            img.src = piece.src;
            img.alt = piece.alt;
            item.appendChild(img);

            const credit = document.createElement('span');
            credit.className = 'curated-gallery-credit';
            credit.textContent = piece.credit;
            item.appendChild(credit);

            item.addEventListener('click', () => this.place(piece));
            container.appendChild(item);
        });
    },

    place: function (piece) {
        const put = (size) => {
            const element = createImageElement(100, 100, piece.src, piece.alt);
            if (size) { element.w = size.w; element.h = size.h; }
            addElement(element);
        };
        const probe = new Image();
        probe.onload = () => put(fitWithin(probe.naturalWidth, probe.naturalHeight, CLIPART_START_MAX));
        probe.onerror = () => put(null);
        probe.src = piece.src;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { fitWithin, clipartTitle, validateClipart, CLIPART_START_MAX };
}
