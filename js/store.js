// store.js — shared app state and pure helpers, ported from tools/ziner/index.html:1100-1117, 1351-1415
// plus new grammar/gallery fields and JSON export/import (modeled on slieve-gullion's ZineStore).

const state = {
    pages: makeBookletPages(() => Date.now() + Math.random()),
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
    viewRotation: 0,      // view-only (single-page/stapled), never saved
    viewZoom: 1,          // view-only, never saved; reset to Fit on format change and load
    meta: { title: '', author: '', info: {} },
    grammar: { origin: [] },   // replaced by data/grammar.json at startup
    galleryImages: [],         // replaced by data/gallery.json at startup
    clipartImages: [],         // replaced by data/clipart.json at startup
    photoImages: [],           // replaced by data/photos.json at startup
    organizer: null            // replaced by data/organizer.json at startup
};

function generateId() {
    return Date.now() + Math.random();
}

// Sheet size of each format on screen, in px at 96/in (PDF points are px × 0.75)
const PAGE_SIZES = {
    'half-letter': { w: 528, h: 816 },
    'single-page': { w: 1056, h: 816 },
    'stapled': { w: 1056, h: 816 },
    'poster-letter': { w: 816, h: 1056 },
    'poster-legal': { w: 816, h: 1344 }
};

function isPoster(format) {
    return format === 'poster-letter' || format === 'poster-legal';
}

const ZOOM_MIN = 0.25, ZOOM_MAX = 2, ZOOM_STEP = 0.25;
const ZOOM_GUTTER = 20;   // .canvas-rotator's margin on each side

// Largest zoom (≤ 100%) at which a sheetW × sheetH sheet, turned by rotation, fits an areaW × areaH area
function fitZoom(areaW, areaH, sheetW, sheetH, rotation) {
    const sideways = (rotation || 0) % 180 !== 0;
    const boxW = sideways ? sheetH : sheetW;
    const boxH = sideways ? sheetW : sheetH;
    const zoom = Math.min(1, (areaW - 2 * ZOOM_GUTTER) / boxW, (areaH - 2 * ZOOM_GUTTER) / boxH);
    return Math.max(ZOOM_MIN, Math.floor(zoom * 100) / 100);
}

// The next 25% step up (direction 1) or down (-1); zoom may be off the grid after Fit
function stepZoom(zoom, direction) {
    const steps = zoom / ZOOM_STEP;
    const next = direction > 0 ? Math.floor(steps + 1e-9) + 1 : Math.ceil(steps - 1e-9) - 1;
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next * ZOOM_STEP));
}

// True when a page holds anything the participant made. Info-form text doesn't count: the form
// keeps its values across a format switch, and Fill in page puts them back.
function zineHasContent(pages) {
    return (pages || []).some(page => (page.elements || []).some(el => !el.fromInfoForm));
}

function randomRotation() {
    return (Math.random() - 0.5) * 6; // -3 to +3 degrees
}

// View rotation: maps a screen offset (dx, dy) from the centre of the rotated sheet to
// unrotated sheet coordinates. rotation is a multiple of 90 (degrees clockwise); cos/sin
// are rounded so results are exact.
function screenToSheet(dx, dy, rotation, sheetW, sheetH) {
    const rad = -rotation * Math.PI / 180;
    const cos = Math.round(Math.cos(rad));
    const sin = Math.round(Math.sin(rad));
    return { x: sheetW / 2 + dx * cos - dy * sin, y: sheetH / 2 + dx * sin + dy * cos };
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

// Fixed or view-only state that isn't part of a saved project
const PROJECT_JSON_SKIP = ['organizer', 'viewRotation', 'viewZoom'];

function exportProjectJSON() {
    const blob = new Blob([JSON.stringify(state, (key, value) => (PROJECT_JSON_SKIP.includes(key) ? undefined : value), 2)], { type: 'application/json' });
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
        const organizer = state.organizer;
        Object.keys(state).forEach(key => delete state[key]);
        Object.assign(state, loaded);
        state.organizer = organizer;
        state.viewRotation = 0;
        state.viewZoom = 1;
        state.meta = Object.assign({ title: '', author: '', info: {} }, state.meta);
        if (!state.meta.info || typeof state.meta.info !== 'object') state.meta.info = {};
        if (state.pageFormat === 'half-letter') {
            const migrated = migrateBookletState(Array.isArray(state.pages) ? state.pages : [], state.currentPage || 0, generateId);
            state.pages = migrated.pages;
            state.currentPage = migrated.currentPage;
            if (migrated.dropped) {
                alert(`${migrated.dropped} page${migrated.dropped === 1 ? '' : 's'} beyond the ${MAX_STORED_INSIDE_PAGES}-page limit were not loaded.`);
            }
        }
        if (onLoaded) onLoaded();
    };
    reader.onerror = function () {
        alert('Could not read the selected project file. Please try again.');
    };
    reader.readAsText(file);
}
