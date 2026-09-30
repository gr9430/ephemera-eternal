// store.js — shared app state and pure helpers, ported from tools/ziner/index.html:1100-1117, 1351-1415
// plus new grammar/gallery fields and JSON export/import (modeled on slieve-gullion's ZineStore).

const state = {
    pages: [{
        id: 1,
        elements: []
    }],
    currentPage: 0,
    selectedId: null,
    editingId: null,
    pageFormat: 'half-letter',
    fonts: {
        'Liberation Mono': 'Liberation Mono'
    },
    dragState: null,
    resizeState: null,
    clipboard: null,
    guidesVisible: true,
    meta: { title: '', author: '' },
    grammar: { origin: [] },   // replaced by data/grammar.json at startup
    galleryImages: [],         // replaced by data/gallery.json at startup
    clipartImages: [],         // replaced by data/clipart.json at startup
    photoImages: []            // replaced by data/photos.json at startup
};

function generateId() {
    return Date.now() + Math.random();
}

function randomRotation() {
    return (Math.random() - 0.5) * 6; // -3 to +3 degrees
}

function getCurrentPage() {
    return state.pages[state.currentPage];
}

function getElementById(id) {
    const page = getCurrentPage();
    const element = page.elements?.find(el => el.id === id);
    if (element) return element;

    if (page.layers) {
        for (const layerType of ['background', 'content', 'overlay']) {
            if (page.layers[layerType]) {
                const element = page.layers[layerType].find(el => el.id === id);
                if (element) return element;
            }
        }
    }

    return null;
}

function getAllElements() {
    const page = getCurrentPage();
    const elements = [...(page.elements || [])];

    if (page.layers) {
        for (const layerType of ['background', 'content', 'overlay']) {
            if (page.layers[layerType]) {
                elements.push(...page.layers[layerType]);
            }
        }
    }

    return elements;
}

function removeElementFromPage(id) {
    const page = getCurrentPage();
    if (page.elements) {
        page.elements = page.elements.filter(el => el.id !== id);
    }
    if (page.layers) {
        for (const layerType of ['background', 'content', 'overlay']) {
            if (page.layers[layerType]) {
                page.layers[layerType] = page.layers[layerType].filter(el => el.id !== id);
            }
        }
    }
}

// ── Save/load whole project as JSON ─────────────────────────────────────────

function exportProjectJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'zine-project.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}

function importProjectJSON(file, onLoaded) {
    const reader = new FileReader();
    reader.onload = function (e) {
        const loaded = JSON.parse(e.target.result);
        Object.keys(state).forEach(key => delete state[key]);
        Object.assign(state, loaded);
        if (onLoaded) onLoaded();
    };
    reader.onerror = function () {
        alert('Could not read the selected project file. Please try again.');
    };
    reader.readAsText(file);
}
