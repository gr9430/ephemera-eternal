// overlays.js — the Overlays panel: textures laid over the whole page (grit, scanner streaks,
// copier edges...), listed in data/overlays.json. Each one carries its own blend mode and
// opacity; Randomize draws from the same list (state.overlays).

// The texture element fields for an overlay (multiply at 30% unless it says otherwise)
function overlayElementFields(overlay) {
    return {
        src: overlay.src,
        alt: overlay.alt || '',
        blendMode: overlay.blendMode || 'multiply',
        opacity: overlay.opacity ?? 0.3
    };
}

const Overlays = {
    init: function () {
        fetch('data/overlays.json')
            .then(r => r.json())
            .then(data => { state.overlays = Array.isArray(data) ? data : []; })
            .catch(() => { state.overlays = []; })
            .then(() => this.render());
    },

    render: function () {
        const container = document.getElementById('overlay-gallery');
        container.innerHTML = '';
        (state.overlays || []).forEach(overlay => {
            const item = document.createElement('div');
            item.className = 'gallery-item overlay-item';
            item.title = overlay.label + (overlay.credit ? ' — ' + overlay.credit : '');
            item.dataset.overlayId = overlay.id;
            const img = document.createElement('img');
            img.src = overlay.src;
            img.alt = '';
            img.loading = 'lazy';
            // White marks only show on dark, so their thumbnail sits on grey
            if (overlay.blendMode === 'normal') item.classList.add('overlay-light');
            item.appendChild(img);
            const label = document.createElement('span');
            label.className = 'overlay-label';
            label.textContent = overlay.label;
            item.appendChild(label);
            item.addEventListener('click', () => this.place(overlay));
            container.appendChild(item);
        });
    },

    place: function (overlay) {
        const fields = overlayElementFields(overlay);
        const element = createTextureElement(0, 0, fields.src, fields.alt, fields.blendMode);
        element.opacity = fields.opacity;
        addElement(element);
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { overlayElementFields };
}
