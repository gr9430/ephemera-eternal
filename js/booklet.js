// booklet.js — half-letter booklet structure and imposition. Pure functions, no DOM:
// loaded as a plain <script> in the browser and with require() in Node tests.
//
// A half-letter booklet's pages each have a role. Inside pages (1–23) are what the
// participant numbers; the cover sheet carries the covers, the participant's "Your info" page and
// Glenn's info page ('glenn-info', rendered from data/organizer.json, never in state.pages).
// The addendum ('addendum', from data/addendum.json, never in state.pages) is the first page of
// the inside signature, facing Your info.

const MAX_INSIDE_PAGES = 23;          // + Page, Import Pages and Randomize stop here (with the addendum: 24)
const MAX_STORED_INSIDE_PAGES = 24;   // loading keeps up to this many, so older 24-page projects stay whole
const WORKSHOP_MAX_INSIDE_PAGES = 11; // ?workshop: 16 pages in all, exactly 4 sheets with no blanks
const BOOKLET_ROLES = ['front-cover', 'their-info', 'inside', 'back-cover'];
const ROLE_LABELS = { 'front-cover': 'Front cover', 'their-info': 'Your info', 'back-cover': 'Back cover' };

function makeBookletPages(newId) {
    return ['front-cover', 'their-info', 'inside', 'back-cover']
        .map(role => ({ id: newId(), role, elements: [] }));
}

function insideIndexes(pages) {
    const indexes = [];
    pages.forEach((page, i) => { if (page && page.role === 'inside') indexes.push(i); });
    return indexes;
}

function pageLabel(pages, index) {
    const page = pages[index];
    if (page && ROLE_LABELS[page.role]) return ROLE_LABELS[page.role];
    if (page && page.role === 'inside') return 'Page ' + (insideIndexes(pages).indexOf(index) + 1);
    return 'Page ' + (index + 1);
}

function slotLabel(slot) {
    if (slot === null) return 'Blank';
    if (typeof slot === 'number') return 'Page ' + (slot + 1);
    if (slot === 'glenn-info') return "Glenn's info";
    if (slot === 'addendum') return 'Addendum';
    return ROLE_LABELS[slot];
}

function slotPageIndex(pages, slot) {
    if (typeof slot === 'number') {
        const index = insideIndexes(pages)[slot];
        return index === undefined ? null : index;
    }
    if (ROLE_LABELS[slot]) {
        const index = pages.findIndex(page => page && page.role === slot);
        return index === -1 ? null : index;
    }
    return null;
}

// Brings any half-letter page list into booklet shape: pages with no (or an unknown) role
// become inside pages, missing covers/info pages are added blank, extra inside pages dropped.
function migrateBookletPages(pages, newId) {
    const find = role => pages.find(page => page && page.role === role) || { id: newId(), role, elements: [] };
    const inside = pages
        .filter(page => page && (page.role === 'inside' || !BOOKLET_ROLES.includes(page.role)))
        .map(page => Object.assign({}, page, { role: 'inside' }));
    if (inside.length === 0) inside.push({ id: newId(), role: 'inside', elements: [] });
    const kept = inside.slice(0, MAX_STORED_INSIDE_PAGES);
    return {
        pages: [find('front-cover'), find('their-info'), ...kept, find('back-cover')],
        dropped: inside.length - kept.length
    };
}

// migrateBookletPages, keeping whichever page was on screen on screen.
function migrateBookletState(pages, currentPage, newId) {
    const current = pages[currentPage];
    const migrated = migrateBookletPages(pages, newId);
    const index = current ? migrated.pages.findIndex(page => page.id === current.id) : -1;
    return { pages: migrated.pages, currentPage: Math.max(index, 0), dropped: migrated.dropped };
}

// Sheet 1 is the cover sheet. The inside signature is the addendum followed by the inside pages,
// rounded up to a multiple of 4 with blank (null) slots at the end, then nested saddle-stitch
// style: sheet s front = last-2s | first+2s. The addendum (first) faces Your info.
function bookletSheets(insideCount) {
    const sheets = [{ front: ['back-cover', 'front-cover'], back: ['their-info', 'glenn-info'] }];
    const total = insideCount + 1;
    const n = Math.ceil(total / 4) * 4;
    const slot = i => (i === 0 ? 'addendum' : i < total ? i - 1 : null);
    for (let s = 0; s < n / 4; s++) {
        sheets.push({
            front: [slot(n - 1 - 2 * s), slot(2 * s)],
            back: [slot(2 * s + 1), slot(n - 2 - 2 * s)]
        });
    }
    return sheets;
}

function sidesInPrintOrder(sheets, mode) {
    const side = (sheet, i, which) => ({ sheet: i + 1, side: which, slots: sheet[which] });
    if (mode === 'two-pass') {
        return sheets.map((s, i) => side(s, i, 'front')).concat(sheets.map((s, i) => side(s, i, 'back')));
    }
    const sides = [];
    sheets.forEach((s, i) => sides.push(side(s, i, 'front'), side(s, i, 'back')));
    return sides;
}

// ── Their-info form ──────────────────────────────────────────────────────────

const INFO_FIELDS = [
    { field: 'name', fontSize: 24, bold: true, h: 40 },
    { field: 'contact', fontSize: 14, bold: false, h: 30 },
    { field: 'date', fontSize: 12, bold: false, h: 24 },
    { field: 'note', fontSize: 14, bold: false, h: 200 }
];

// After Randomize (info.randomized) the note is always this text, locked on the page
const RANDOMIZED_NOTE = 'I forewent my creativity to an algorithm and all I got was this zine! Maybe I edited it along the way...';

function infoFormLayout(info) {
    const specs = [];
    let y = 48;
    INFO_FIELDS.forEach(({ field, fontSize, bold, h }) => {
        const locked = field === 'note' && Boolean(info && info.randomized);
        const content = locked ? RANDOMIZED_NOTE : ((info && info[field]) || '').trim();
        if (!content) return;
        specs.push(Object.assign({ field, content, x: 48, y, w: 432, h, fontSize, bold }, locked ? { locked: true } : {}));
        y += h + 16;
    });
    return specs;
}

function replaceInfoFormElements(elements, specs, makeText) {
    return elements.filter(el => !el.fromInfoForm).concat(specs.map(makeText));
}

// ── Importing inside pages from other saved projects (group zines) ───────────

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isElementList = list => Array.isArray(list) && list.every(isObject);

// Imported files come from other people's machines: every page must be an object whose
// elements (and any legacy layers) are lists of objects, or the whole file is skipped.
function isImportablePage(page) {
    if (!isObject(page)) return false;
    if (page.elements !== undefined && !isElementList(page.elements)) return false;
    if (page.layers !== undefined && !(isObject(page.layers) && Object.values(page.layers).every(isElementList))) return false;
    return true;
}

function importInsidePages(pages, projects, newId, limit = MAX_INSIDE_PAGES) {
    const result = pages.slice();
    let imported = 0, skipped = 0;
    const skippedFiles = [];

    projects.forEach(({ name, data }) => {
        if (!data || !Array.isArray(data.pages) || (data.pageFormat || 'half-letter') !== 'half-letter' ||
            !data.pages.every(isImportablePage)) {
            skippedFiles.push(name);
            return;
        }
        const hasRoles = data.pages.some(page => page.role);
        const source = hasRoles ? data.pages.filter(page => page.role === 'inside') : data.pages;
        source.forEach(page => {
            const inside = insideIndexes(result);
            if (inside.length >= limit) { skipped++; return; }
            const copy = JSON.parse(JSON.stringify(page));
            copy.id = newId();
            copy.role = 'inside';
            copy.elements = (copy.elements || []).map(el => Object.assign(el, { id: newId() }));
            if (copy.layers) {
                Object.values(copy.layers).forEach(layer => (layer || []).forEach(el => { el.id = newId(); }));
            }
            result.splice(inside[inside.length - 1] + 1, 0, copy);
            imported++;
        });
    });
    return { pages: result, imported, skipped, skippedFiles };
}

function importSummary(result, unreadable, limit = MAX_INSIDE_PAGES) {
    let text = `Imported ${result.imported} page${result.imported === 1 ? '' : 's'}`;
    if (result.skipped) text += `, skipped ${result.skipped} (${limit}-page limit)`;
    const notImported = result.skippedFiles.concat(unreadable || []);
    if (notImported.length) text += `. Not imported: ${notImported.join(', ')}`;
    return text + '.';
}

if (typeof module !== 'undefined') {
    module.exports = {
        MAX_INSIDE_PAGES, MAX_STORED_INSIDE_PAGES, WORKSHOP_MAX_INSIDE_PAGES, BOOKLET_ROLES, makeBookletPages, insideIndexes, pageLabel, slotLabel,
        slotPageIndex, migrateBookletPages, migrateBookletState, bookletSheets, sidesInPrintOrder,
        infoFormLayout, replaceInfoFormElements, RANDOMIZED_NOTE, importInsidePages, importSummary
    };
}
