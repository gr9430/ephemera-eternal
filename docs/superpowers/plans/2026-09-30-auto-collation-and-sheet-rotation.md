# Auto-collation and Sheet Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Half-letter zines become booklets (covers, participant info, Glenn's info, 1–24 inside pages) that export as an auto-collated PDF; single-page and stapled sheets can be viewed at 0/90/180/270° while editing.

**Architecture:** All booklet logic that can be pure (page roles, migration, imposition, print order, info-form layout, page import) lives in a new `js/booklet.js` with Node tests. DOM code stays where it already lives: `js/editor.js` (tabs, pages, preview, rotation, pointer maths), `js/export.js` (PDF), `js/autosave.js` / `js/store.js` (load/save), plus two small new modules, `js/organizer.js` (Glenn's info page) and `js/infoform.js` (participant form). Rotation is view-only: a CSS transform on `.canvas-container` inside a new `.canvas-rotator` wrapper, with every pointer position mapped back to sheet coordinates through one helper.

**Tech Stack:** Plain browser JS (global `<script>` files, no bundler), html2canvas 1.4.1 and jsPDF 2.5.1 from CDN, Node for unit tests (`node js/<name>.test.js`), Playwright + headless Chromium for browser checks (`tests/browser/*.cjs`).

**Spec:** `docs/superpowers/specs/2026-09-30-auto-collation-and-sheet-rotation-design.md`

## Global Constraints

- **Do not `git add` or `git commit`.** Glenn commits himself. Each task ends with a test checkpoint instead of a commit.
- No build step, no new runtime dependencies; new JS files are plain `<script src>` includes in `index.html`.
- Page sizes in canvas px: half-letter 528 × 816; single-page and stapled 1056 × 816. Margin 24 px.
- PDF pages for booklets: 11" × 8.5" landscape = 792 × 612 pt; each half is 396 pt wide.
- Paper colour: `#f8f8f0`.
- Inside-page limit: 24 (`MAX_INSIDE_PAGES`).
- Booklet roles: `'front-cover' | 'their-info' | 'inside' | 'back-cover'`; Glenn's page is the slot `'glenn-info'` and is never in `state.pages`.
- Cover sheet: front `Back cover | Front cover`, back `Their info | Glenn's info`.
- Export dialog notes, verbatim: "Print double-sided, flip on short edge." and "Print the first half, put the printed stack back in the tray, then print the second half. Try with one sheet first — printers differ in how the stack goes back in."
- Booklet PDF filename: `zine-booklet-<duplex|two-pass>-<YYYY-MM-DD>.pdf`.
- `state.viewRotation` is never saved (not in project JSON, not in autosave) and resets to 0 on format change, New, and load.
- Stapled panel order is out of scope (deferred).
- Running unit tests: `for f in js/*.test.js; do node "$f" > /dev/null || echo "FAIL $f"; done` — prints nothing when all pass.
- Running browser checks (Playwright is installed in the session scratchpad, Chromium in the Playwright cache):
  ```bash
  export NODE_PATH=/tmp/claude-1000/-home-user-repos-ephemera-eternal/eede6b45-35b1-482f-b35a-28643bdccde6/scratchpad/node_modules
  export CHROME_PATH=$(ls ~/.cache/ms-playwright/chromium_headless_shell-1223/*/chrome-headless-shell)
  node tests/browser/<name>.cjs
  ```
  The page loads html2canvas and jsPDF from cdnjs, so the machine needs network access.

## Review Focus

1. **Old projects and autosaves** (half-letter pages without `role`) must open with every page kept as an inside page, the page on screen kept on screen, and covers/their-info added — never a blank zine. Tests: Task 1 (`migrateBookletState`), Task 2 (autosave round trip).
2. **Missing or broken `data/organizer.json`** must not break export or preview; Glenn's slot shows "Organizer info not set". Test: Task 4 browser check exports with `state.organizer = null`.
3. **Importing a file that isn't a half-letter project** (bad JSON, single-page project, random JSON) must skip just that file, name it in the notice, and still import the good ones. Tests: Task 6 unit + browser.
4. **Hitting 24 inside pages** must disable "+ Page" and stop imports at the cap with the skipped count reported. Tests: Task 2 browser check, Task 6 unit.
5. **Filling the info form again with fields cleared** must remove the old form-made text and keep the participant's own elements. Test: Task 5 unit.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `js/booklet.js` | create | Pure booklet logic: roles, labels, migration, `bookletSheets`, print order, info-form layout, page import, import summary |
| `js/booklet.test.js` | create | Node tests for `booklet.js` |
| `js/organizer.js` | create | Load `data/organizer.json`; `buildOrganizerPage()` DOM |
| `data/organizer.json` | create | Glenn's info content |
| `js/infoform.js` | create | Their-info form panel |
| `js/rotation.test.js` | create | Node tests for `screenToSheet` |
| `tests/browser/harness.cjs` | create | Static server + Chromium launcher + assert helpers |
| `tests/browser/booklet-structure.cjs` | create | Tabs, add/remove page, 24 cap |
| `tests/browser/booklet-export.cjs` | create | PDF imposition both modes, dialog, organizer missing |
| `tests/browser/booklet-preview.cjs` | create | Preview booklet view |
| `tests/browser/info-and-import.cjs` | create | Info form + Import pages |
| `tests/browser/rotation.cjs` | create | Drag at each rotation, export unrotated |
| `js/store.js` | modify | Initial booklet pages, `state.organizer`, `state.viewRotation`, `screenToSheet`, JSON save/load |
| `js/autosave.js` | modify | Migration on restore, keep `meta.info`, New builds booklet |
| `js/autosave.test.js` | modify | Load `booklet.js` into sandbox; migration tests |
| `js/editor.js` | modify | Tabs, add/remove page, format switch, preview views, rotation, pointer mapping |
| `js/export.js` | modify | Booklet PDF, export dialog, Import pages wiring |
| `index.html` | modify | Script tags, format label, buttons, dialogs, info panel, rotator wrapper |
| `css/editor.css` | modify | Organizer page, export dialog, preview spreads, info panel, rotator |
| `README.md` | modify | Booklets, `organizer.json`, browser checks |

---

### Task 1: Pure booklet logic (`js/booklet.js`)

**Files:**
- Create: `js/booklet.js`
- Test: `js/booklet.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (globals in the browser; `module.exports` in Node):
  - `MAX_INSIDE_PAGES` = 24; `BOOKLET_ROLES` (array of the four roles)
  - `makeBookletPages(newId: () => number) -> Page[]` — `[front-cover, their-info, inside, back-cover]`, each `{ id, role, elements: [] }`
  - `insideIndexes(pages) -> number[]` — indexes into `pages` of `role === 'inside'`, in order
  - `pageLabel(pages, index) -> string` — `'Front cover' | 'Their info' | 'Back cover' | 'Page N'` (N = 1-based inside number; for pages without a role, N = index + 1)
  - `slotLabel(slot) -> string` — number → `'Page ' + (slot + 1)`, `'glenn-info'` → `"Glenn's info"`, role → its label, `null` → `'Blank'`
  - `slotPageIndex(pages, slot) -> number | null` — index into `pages` for a role or inside-number slot; `null` for `'glenn-info'` and `null`
  - `migrateBookletPages(pages, newId) -> { pages, dropped }`
  - `migrateBookletState(pages, currentPage, newId) -> { pages, currentPage, dropped }`
  - `bookletSheets(insideCount) -> [{ front: [Slot, Slot], back: [Slot, Slot] }]`
  - `sidesInPrintOrder(sheets, mode: 'duplex' | 'two-pass') -> [{ sheet: number (1-based), side: 'front' | 'back', slots: [Slot, Slot] }]`
  - `infoFormLayout(info) -> [{ field, content, x, y, w, h, fontSize, bold }]`
  - `replaceInfoFormElements(elements, specs, makeText) -> Element[]`
  - `importInsidePages(pages, projects: [{ name, data }], newId) -> { pages, imported, skipped, skippedFiles }`
  - `importSummary(result, unreadable: string[]) -> string`

- [ ] **Step 1: Write the failing tests**

Create `js/booklet.test.js`:

```js
/**
 * booklet.test.js — Node.js test for the pure booklet logic in booklet.js.
 * No DOM required.
 */

'use strict';

const B = require('./booklet.js');

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}

let nextId = 1000;
const newId = () => nextId++;
const inside = n => Array.from({ length: n }, (_, i) => ({ id: i + 1, role: 'inside', elements: [] }));
const fmt = slot => slot === null ? '-' : typeof slot === 'number' ? String(slot + 1) : slot;
const sheetRows = sheets => sheets.map(s => `${fmt(s.front[0])}|${fmt(s.front[1])} ${fmt(s.back[0])}|${fmt(s.back[1])}`);

console.log('[makeBookletPages]');
{
    const pages = B.makeBookletPages(newId);
    assert('four pages in role order', pages.map(p => p.role).join() === 'front-cover,their-info,inside,back-cover');
    assert('each has its own id and empty elements', new Set(pages.map(p => p.id)).size === 4 && pages.every(p => p.elements.length === 0));
}

console.log('[labels]');
{
    const pages = B.makeBookletPages(newId);
    pages.splice(3, 0, { id: newId(), role: 'inside', elements: [] });
    assert('cover and info labels', B.pageLabel(pages, 0) === 'Front cover' && B.pageLabel(pages, 1) === 'Their info' && B.pageLabel(pages, 4) === 'Back cover');
    assert('inside pages are numbered from 1', B.pageLabel(pages, 2) === 'Page 1' && B.pageLabel(pages, 3) === 'Page 2');
    assert('pages without a role use their position', B.pageLabel([{}, {}], 1) === 'Page 2');
    assert('slot labels', B.slotLabel(0) === 'Page 1' && B.slotLabel('glenn-info') === "Glenn's info" && B.slotLabel(null) === 'Blank' && B.slotLabel('back-cover') === 'Back cover');
    assert('insideIndexes', B.insideIndexes(pages).join() === '2,3');
    assert('slotPageIndex for roles and inside numbers', B.slotPageIndex(pages, 'their-info') === 1 && B.slotPageIndex(pages, 1) === 3);
    assert('slotPageIndex is null for Glenn and blanks', B.slotPageIndex(pages, 'glenn-info') === null && B.slotPageIndex(pages, null) === null);
}

console.log('[bookletSheets matches Glenn\'s tables]');
{
    const cover = 'back-cover|front-cover their-info|glenn-info';
    const tables = {
        4:  [cover, '4|1 2|3'],
        8:  [cover, '8|1 2|7', '6|3 4|5'],
        12: [cover, '12|1 2|11', '10|3 4|9', '8|5 6|7'],
        16: [cover, '16|1 2|15', '14|3 4|13', '12|5 6|11', '10|7 8|9'],
        20: [cover, '20|1 2|19', '18|3 4|17', '16|5 6|15', '14|7 8|13', '12|9 10|11'],
        24: [cover, '24|1 2|23', '22|3 4|21', '20|5 6|19', '18|7 8|17', '16|9 10|15', '14|11 12|13']
    };
    Object.entries(tables).forEach(([n, rows]) => {
        assert(`${n} inside pages`, sheetRows(B.bookletSheets(Number(n))).join(' / ') === rows.join(' / '));
    });
}

console.log('[bookletSheets padding]');
{
    for (const n of [1, 5, 6]) {
        const sheets = B.bookletSheets(n);
        const slots = sheets.slice(1).flatMap(s => [...s.front, ...s.back]);
        const numbers = slots.filter(s => s !== null).sort((a, b) => a - b);
        const padded = Math.ceil(n / 4) * 4;
        assert(`${n}: every inside page appears exactly once`, numbers.join() === Array.from({ length: n }, (_, i) => i).join());
        assert(`${n}: blanks fill the rest`, slots.filter(s => s === null).length === padded - n);
        assert(`${n}: cover sheet + ${padded / 4} inside sheets`, sheets.length === 1 + padded / 4);
    }
    assert('6 pages: blanks are pages 7 and 8', sheetRows(B.bookletSheets(6))[1] === '-|1 2|-');
}

console.log('[sidesInPrintOrder]');
{
    const sheets = B.bookletSheets(8);
    const order = mode => B.sidesInPrintOrder(sheets, mode).map(s => s.sheet + s.side[0]).join();
    assert('duplex alternates front/back per sheet', order('duplex') === '1f,1b,2f,2b,3f,3b');
    assert('two-pass prints all fronts then all backs', order('two-pass') === '1f,2f,3f,1b,2b,3b');
    assert('sides carry their slots', B.sidesInPrintOrder(sheets, 'duplex')[1].slots.join() === 'their-info,glenn-info');
}

console.log('[migrateBookletPages]');
{
    const legacy = [{ id: 1, elements: [{ id: 9 }] }, { id: 2, elements: [] }];
    const { pages, dropped } = B.migrateBookletPages(legacy, newId);
    assert('roleless pages become inside pages, in order', pages.map(p => p.role).join() === 'front-cover,their-info,inside,inside,back-cover');
    assert('content kept', pages[2].elements[0].id === 9 && pages[3].id === 2);
    assert('nothing dropped', dropped === 0);

    const tooMany = B.migrateBookletPages(inside(30), newId);
    assert('keeps the first 24 inside pages', B.insideIndexes(tooMany.pages).length === 24 && tooMany.pages[2].id === 1);
    assert('reports 6 dropped', tooMany.dropped === 6);

    const already = B.makeBookletPages(newId);
    const again = B.migrateBookletPages(already, newId);
    assert('already-migrated pages keep their ids', again.pages.map(p => p.id).join() === already.map(p => p.id).join());

    const empty = B.migrateBookletPages([], newId);
    assert('no pages gets one blank inside page', B.insideIndexes(empty.pages).length === 1);
}

console.log('[migrateBookletState keeps the page on screen]');
{
    const legacy = [{ id: 1, elements: [] }, { id: 2, elements: [] }, { id: 3, elements: [] }];
    const m = B.migrateBookletState(legacy, 1, newId);
    assert('old page 2 is now at index 3', m.currentPage === 3 && m.pages[3].id === 2);
    const gone = B.migrateBookletState(inside(30), 29, newId);
    assert('a dropped current page falls back to 0', gone.currentPage === 0);
}

console.log('[infoFormLayout]');
{
    const specs = B.infoFormLayout({ name: 'Ana', contact: '', date: '1 Oct', note: 'hello' });
    assert('one spec per filled field, in field order', specs.map(s => s.field).join() === 'name,date,note');
    assert('stacked top-down inside the margins', specs.every((s, i) => s.x >= 24 && s.x + s.w <= 504 && (i === 0 || s.y > specs[i - 1].y)));
    assert('name is bold', specs[0].bold === true && specs[0].content === 'Ana');
    assert('blank and missing fields give nothing', B.infoFormLayout({ name: '  ' }).length === 0 && B.infoFormLayout(undefined).length === 0);
}

console.log('[replaceInfoFormElements]');
{
    const makeText = spec => ({ id: newId(), content: spec.content, fromInfoForm: true });
    const own = { id: 1, content: 'my doodle' };
    const first = B.replaceInfoFormElements([own], B.infoFormLayout({ name: 'Ana', note: 'x' }), makeText);
    assert('adds form elements after the participant\'s own', first.length === 3 && first[0] === own);
    const second = B.replaceInfoFormElements(first, B.infoFormLayout({ name: 'Bo' }), makeText);
    assert('refilling replaces only form elements', second.length === 2 && second[0] === own && second[1].content === 'Bo');
    const cleared = B.replaceInfoFormElements(second, B.infoFormLayout({}), makeText);
    assert('refilling with every field cleared removes the old form text', cleared.length === 1 && cleared[0] === own);
}

console.log('[importInsidePages]');
{
    const base = B.makeBookletPages(newId);
    const booklet = { name: 'a.json', data: { pageFormat: 'half-letter', pages: [
        { id: 1, role: 'front-cover', elements: [{ id: 5 }] },
        { id: 2, role: 'inside', elements: [{ id: 6, content: 'A1' }] },
        { id: 3, role: 'inside', elements: [{ id: 7, content: 'A2' }], layers: { overlay: [{ id: 8 }] } },
        { id: 4, role: 'back-cover', elements: [] }
    ] } };
    const legacy = { name: 'old.json', data: { pageFormat: 'half-letter', pages: [{ id: 1, elements: [{ id: 6, content: 'L1' }] }] } };
    const sheet = { name: 'sheet.json', data: { pageFormat: 'single-page', pages: [{ id: 1, elements: [] }] } };
    const junk = { name: 'junk.json', data: { hello: 'world' } };

    const r = B.importInsidePages(base, [booklet, sheet, legacy, junk], newId);
    const insideContent = B.insideIndexes(r.pages).map(i => (r.pages[i].elements[0] || {}).content || '');
    assert('appends inside pages after the last inside page, file then page order', insideContent.join() === ',A1,A2,L1');
    assert('back cover stays last', r.pages[r.pages.length - 1].role === 'back-cover');
    assert('covers of imported files ignored', r.pages.filter(p => p.role === 'front-cover').length === 1);
    assert('counts imported pages', r.imported === 3 && r.skipped === 0);
    assert('non-booklet files named as skipped', r.skippedFiles.join() === 'sheet.json,junk.json');
    const ids = r.pages.flatMap(p => [p.id, ...p.elements.map(e => e.id), ...Object.values(p.layers || {}).flat().map(e => e.id)]);
    assert('every page and element id is fresh and unique', new Set(ids).size === ids.length && !ids.includes(6) && !ids.includes(8));
    assert('source data not modified', booklet.data.pages[1].elements[0].id === 6);

    const full = B.migrateBookletPages(inside(23), newId).pages;
    const capped = B.importInsidePages(full, [booklet], newId);
    assert('stops at 24 inside pages', B.insideIndexes(capped.pages).length === 24 && capped.imported === 1 && capped.skipped === 1);
}

console.log('[importSummary]');
{
    assert('plain', B.importSummary({ imported: 3, skipped: 0, skippedFiles: [] }, []) === 'Imported 3 pages.');
    assert('one page, cap and bad files',
        B.importSummary({ imported: 1, skipped: 2, skippedFiles: ['s.json'] }, ['bad.json']) ===
        'Imported 1 page, skipped 2 (24-page limit). Not imported: s.json, bad.json.');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node js/booklet.test.js`
Expected: crash with `Cannot find module './booklet.js'`.

- [ ] **Step 3: Implement `js/booklet.js`**

```js
// booklet.js — half-letter booklet structure and imposition. Pure functions, no DOM:
// loaded as a plain <script> in the browser and with require() in Node tests.
//
// A half-letter booklet's pages each have a role. Inside pages (1–24) are what the
// participant numbers; the cover sheet carries the covers, their info page and
// Glenn's info page ('glenn-info', rendered from data/organizer.json, never in state.pages).

const MAX_INSIDE_PAGES = 24;
const BOOKLET_ROLES = ['front-cover', 'their-info', 'inside', 'back-cover'];
const ROLE_LABELS = { 'front-cover': 'Front cover', 'their-info': 'Their info', 'back-cover': 'Back cover' };

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
    const kept = inside.slice(0, MAX_INSIDE_PAGES);
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

// Sheet 1 is the cover sheet. Inside pages are rounded up to a multiple of 4 with blank
// (null) slots at the end, then nested saddle-stitch style: sheet s front = last-2s | first+2s.
function bookletSheets(insideCount) {
    const sheets = [{ front: ['back-cover', 'front-cover'], back: ['their-info', 'glenn-info'] }];
    const n = Math.ceil(Math.max(insideCount, 1) / 4) * 4;
    const slot = i => (i < insideCount ? i : null);
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

function infoFormLayout(info) {
    const specs = [];
    let y = 48;
    INFO_FIELDS.forEach(({ field, fontSize, bold, h }) => {
        const content = ((info && info[field]) || '').trim();
        if (!content) return;
        specs.push({ field, content, x: 48, y, w: 432, h, fontSize, bold });
        y += h + 16;
    });
    return specs;
}

function replaceInfoFormElements(elements, specs, makeText) {
    return elements.filter(el => !el.fromInfoForm).concat(specs.map(makeText));
}

// ── Importing inside pages from other saved projects (group zines) ───────────

function importInsidePages(pages, projects, newId) {
    const result = pages.slice();
    let imported = 0, skipped = 0;
    const skippedFiles = [];

    projects.forEach(({ name, data }) => {
        if (!data || !Array.isArray(data.pages) || (data.pageFormat || 'half-letter') !== 'half-letter') {
            skippedFiles.push(name);
            return;
        }
        const hasRoles = data.pages.some(page => page && page.role);
        const source = hasRoles ? data.pages.filter(page => page && page.role === 'inside') : data.pages;
        source.forEach(page => {
            const inside = insideIndexes(result);
            if (inside.length >= MAX_INSIDE_PAGES) { skipped++; return; }
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

function importSummary(result, unreadable) {
    let text = `Imported ${result.imported} page${result.imported === 1 ? '' : 's'}`;
    if (result.skipped) text += `, skipped ${result.skipped} (24-page limit)`;
    const notImported = result.skippedFiles.concat(unreadable || []);
    if (notImported.length) text += `. Not imported: ${notImported.join(', ')}`;
    return text + '.';
}

if (typeof module !== 'undefined') {
    module.exports = {
        MAX_INSIDE_PAGES, BOOKLET_ROLES, makeBookletPages, insideIndexes, pageLabel, slotLabel,
        slotPageIndex, migrateBookletPages, migrateBookletState, bookletSheets, sidesInPrintOrder,
        infoFormLayout, replaceInfoFormElements, importInsidePages, importSummary
    };
}
```

Note: `importInsidePages` requires the target `pages` to already contain at least one inside page (true for every half-letter project after migration).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node js/booklet.test.js`
Expected: last line `N passed, 0 failed`, exit code 0.

- [ ] **Step 5: Checkpoint**

Run the full unit suite (Global Constraints). Expected: no output.

---

### Task 2: Booklet structure in the editor, autosave and project load

**Files:**
- Create: `tests/browser/harness.cjs`, `tests/browser/booklet-structure.cjs`
- Modify: `index.html` (script tag, format label), `js/store.js` (initial pages, `importProjectJSON`), `js/autosave.js` (`apply`, `restore`, `startNew`), `js/autosave.test.js`, `js/editor.js` (format switch ~line 795, `addPage`/`removePage` ~line 960, `renderPageTabs` ~line 1987, `updateToolStates` ~line 2011)

**Interfaces:**
- Consumes: Task 1 `makeBookletPages`, `insideIndexes`, `pageLabel`, `migrateBookletState`, `MAX_INSIDE_PAGES`.
- Produces: half-letter `state.pages` always in booklet shape; `state.meta.info` (object, may be empty) preserved by autosave and project load; `Autosave.apply(data)` now returns `{ dropped }`; browser harness `open()`, `assert()`, `done()` from `tests/browser/harness.cjs`.

- [ ] **Step 1: Add the failing autosave tests**

In `js/autosave.test.js`, change `load()` so `booklet.js` is evaluated before `autosave.js`:

```js
    vm.createContext(sandbox);
    const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
    vm.runInContext(read('booklet.js') + '\n' + read('autosave.js') + '\nthis.Autosave = Autosave;', sandbox);
```

In the `[apply sanitizes bad input]` block, the `poster` format falls back to half-letter, which is now migrated (the one old page becomes inside page 1 at index 2). Replace

```js
    assert('clamps current page', state.currentPage === 0);
```

with

```js
    assert('clamps current page, then follows it to its booklet position', state.currentPage === 2);
```

Then add before the final summary lines:

```js
console.log('[half-letter autosave from before booklets]');
{
    const { sandbox } = load();
    const { state, Autosave } = sandbox;
    const result = Autosave.apply({
        app: 'zine-workshop', pageFormat: 'half-letter', currentPage: 1,
        meta: { title: 'T', author: 'A', info: { name: 'Ana' } },
        pages: [{ id: 1, elements: [{ id: 7 }] }, { id: 2, elements: [{ id: 8 }] }]
    });
    assert('old pages become inside pages between covers and info',
        state.pages.map(p => p.role).join() === 'front-cover,their-info,inside,inside,back-cover');
    assert('content kept', state.pages[2].elements[0].id === 7 && state.pages[3].elements[0].id === 8);
    assert('the page that was on screen stays on screen', state.currentPage === 3);
    assert('keeps meta.info', state.meta.info.name === 'Ana' && state.meta.title === 'T');
    assert('reports nothing dropped', result.dropped === 0);
}

console.log('[stapled autosave is not migrated]');
{
    const { sandbox } = load();
    const { state, Autosave } = sandbox;
    Autosave.apply({ app: 'zine-workshop', pageFormat: 'stapled', pages: [{ id: 1 }, { id: 2 }] });
    assert('no roles added', state.pages.length === 2 && !state.pages[0].role);
    assert('meta.info defaults to empty', state.meta && typeof state.meta.info === 'object');
}
```

Note the second block's `meta.info` assert: `apply` must give `state.meta` an `info` object even when the saved data has no `meta`.

- [ ] **Step 2: Run to verify they fail**

Run: `node js/autosave.test.js`
Expected: FAIL lines for the new asserts (roles missing, `result` undefined → TypeError, or similar).

- [ ] **Step 3: Update `Autosave.apply`, `restore`, `startNew`**

In `js/autosave.js` replace the body of `apply` from `const pages = data.pages.map(` through `state.resizeState = null;` with:

```js
        let pages = data.pages.map((page, i) => {
            const restored = Object.assign({}, page);
            restored.id = page && page.id != null ? page.id : Date.now() + i;
            restored.elements = Array.isArray(page && page.elements) ? page.elements : [];
            return restored;
        });
        const pageFormat = Autosave.VALID_FORMATS.includes(data.pageFormat) ? data.pageFormat : 'half-letter';
        let currentPage = Math.min(Math.max(parseInt(data.currentPage, 10) || 0, 0), pages.length - 1);
        let dropped = 0;
        if (pageFormat === 'half-letter') {
            const migrated = migrateBookletState(pages, currentPage, () => Date.now() + Math.random());
            pages = migrated.pages;
            currentPage = migrated.currentPage;
            dropped = migrated.dropped;
        }

        state.pages = pages;
        state.pageFormat = pageFormat;
        state.currentPage = currentPage;
        const meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
        state.meta = {
            title: meta.title || '',
            author: meta.author || '',
            info: meta.info && typeof meta.info === 'object' ? Object.assign({}, meta.info) : {}
        };
        state.selectedId = null;
        state.editingId = null;
        state.dragState = null;
        state.resizeState = null;
```

Keep the following `document.getElementById('page-format').value = state.pageFormat;` line, and add after it:

```js
        return { dropped };
```

Note: previously `state.meta` was left untouched when the save had no `meta`; it is now always reset, which is correct for a restore.

In `restore`, replace `Autosave.apply(JSON.parse(saved));` with:

```js
                const { dropped } = Autosave.apply(JSON.parse(saved));
                if (dropped) {
                    Autosave.showNotice(`${dropped} page${dropped === 1 ? '' : 's'} beyond the ${MAX_INSIDE_PAGES}-page limit could not be restored.`);
                }
```

In `startNew`, replace the `state.pages = ...` statement and the `state.meta = ...` line with:

```js
        state.pages = state.pageFormat === 'stapled'
            ? [{ id: 1, elements: [] }, { id: 2, elements: [] }]
            : state.pageFormat === 'half-letter'
                ? makeBookletPages(generateId)
                : [{ id: 1, elements: [] }];
```

```js
        state.meta = { title: '', author: '', info: {} };
```

- [ ] **Step 4: Run autosave tests**

Run: `node js/autosave.test.js`
Expected: `N passed, 0 failed`.

- [ ] **Step 5: Wire booklet structure into the page**

`index.html`: add `<script src="js/booklet.js"></script>` immediately **before** `<script src="js/store.js"></script>`, and change the half-letter option text to:

```html
                    <option value="half-letter">Half-Letter Booklet (5.5" × 8.5" pages)</option>
```

`js/store.js`: in the `state` literal replace

```js
    pages: [{
        id: 1,
        elements: []
    }],
```

with

```js
    pages: makeBookletPages(() => Date.now() + Math.random()),
```

and change `meta: { title: '', author: '' },` to `meta: { title: '', author: '', info: {} },`.

In `importProjectJSON`, after `Object.assign(state, loaded);` add:

```js
        state.meta = Object.assign({ title: '', author: '', info: {} }, state.meta);
        if (!state.meta.info || typeof state.meta.info !== 'object') state.meta.info = {};
        if (state.pageFormat === 'half-letter') {
            const migrated = migrateBookletState(Array.isArray(state.pages) ? state.pages : [], state.currentPage || 0, generateId);
            state.pages = migrated.pages;
            state.currentPage = migrated.currentPage;
            if (migrated.dropped) {
                alert(`${migrated.dropped} page${migrated.dropped === 1 ? '' : 's'} beyond the ${MAX_INSIDE_PAGES}-page limit were not loaded.`);
            }
        }
```

`js/editor.js`, format switch handler (`document.getElementById('page-format').addEventListener('change', ...)`): replace the `if (newFormat === 'stapled') { ... } else { ... }` block with:

```js
                    if (newFormat === 'stapled') {
                        // Stapled format needs 2 pages
                        state.pages = [
                            { id: 1, elements: [] },
                            { id: 2, elements: [] }
                        ];
                    } else if (newFormat === 'half-letter') {
                        state.pages = makeBookletPages(generateId);
                    } else {
                        state.pages = [
                            { id: 1, elements: [] }
                        ];
                    }
                    state.currentPage = 0;
```

Replace `addPage` and `removePage` with:

```js
        function addPage() {
            if (state.pageFormat === 'half-letter') {
                const inside = insideIndexes(state.pages);
                if (inside.length >= MAX_INSIDE_PAGES) return;
                // After the current inside page, or after the last one when on a cover/info tab
                const after = getCurrentPage().role === 'inside' ? state.currentPage : inside[inside.length - 1];
                state.pages.splice(after + 1, 0, { id: generateId(), role: 'inside', elements: [] });
                state.currentPage = after + 1;
            } else {
                state.pages.push({
                    id: Date.now(),
                    elements: [] // Simple elements array
                });
                state.currentPage = state.pages.length - 1;
            }
            state.selectedId = null;
            state.editingId = null;
            render();
        }

        function removePage() {
            if (state.pageFormat === 'half-letter') {
                // Only inside pages can go, and never the last one
                if (getCurrentPage().role !== 'inside' || insideIndexes(state.pages).length <= 1) return;
            } else if (state.pages.length <= 1) {
                return;
            }
            state.pages.splice(state.currentPage, 1);
            if (state.currentPage >= state.pages.length) {
                state.currentPage = state.pages.length - 1;
            }
            state.selectedId = null;
            state.editingId = null;
            render();
        }
```

In `renderPageTabs`, replace `` tab.textContent = `Page ${index + 1}`; `` with:

```js
                tab.textContent = pageLabel(state.pages, index);
```

In `updateToolStates`, replace the two `if (addPageBtn) ...` / `if (removePageBtn) ...` lines with:

```js
            if (state.pageFormat === 'half-letter') {
                const insideCount = insideIndexes(state.pages).length;
                if (addPageBtn) addPageBtn.disabled = insideCount >= MAX_INSIDE_PAGES;
                if (removePageBtn) removePageBtn.disabled = getCurrentPage().role !== 'inside' || insideCount <= 1;
            } else {
                if (addPageBtn) addPageBtn.disabled = isSinglePageFormat;
                if (removePageBtn) removePageBtn.disabled = isSinglePageFormat || state.pages.length <= 1;
            }
```

- [ ] **Step 6: Write the browser harness and the failing-then-passing structure check**

Create `tests/browser/harness.cjs`:

```js
// harness.cjs — shared setup for browser checks: serves the repo over HTTP and opens
// index.html in headless Chromium. Needs Playwright on NODE_PATH; set CHROME_PATH to a
// Chromium/Chrome binary when Playwright's own browser download isn't installed.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const TYPES = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2',
    '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf'
};

function serve() {
    return new Promise(resolve => {
        const server = http.createServer((req, res) => {
            const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
            if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
                res.writeHead(404);
                res.end();
                return;
            }
            res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
            fs.createReadStream(file).pipe(res);
        });
        server.listen(0, () => resolve(server));
    });
}

async function open(viewport = { width: 1600, height: 1000 }) {
    const server = await serve();
    const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
    const page = await browser.newPage({ viewport });
    page.on('pageerror', error => console.log('  PAGE ERROR: ' + error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto(`http://localhost:${server.address().port}/index.html`);
    // index.html ships a static "Page 1" tab, so wait for the app's first render to replace it
    await page.waitForFunction(() => typeof Autosave !== 'undefined' && Autosave.enabled &&
        document.querySelectorAll('.page-tab').length === state.pages.length &&
        document.querySelector('.page-tab').textContent === pageLabel(state.pages, 0));
    return { page, close: async () => { await browser.close(); server.close(); } };
}

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}

function done() {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
}

module.exports = { open, assert, done };
```

Create `tests/browser/booklet-structure.cjs`:

```js
// booklet-structure.cjs — half-letter tabs, adding/removing pages, the 24-page cap.
'use strict';

const { open, assert, done } = require('./harness.cjs');

(async () => {
    const { page, close } = await open();
    const tabs = () => page.$$eval('.page-tab', els => els.map(e => e.textContent));
    const disabled = id => page.$eval('#' + id, el => el.disabled);

    console.log('[new half-letter zine]');
    assert('format label renamed', (await page.$eval('#page-format option[value="half-letter"]', o => o.textContent)).startsWith('Half-Letter Booklet'));
    assert('tabs are covers, info and page 1', (await tabs()).join() === 'Front cover,Their info,Page 1,Back cover');
    assert('cannot remove a cover', await disabled('remove-page-btn'));

    console.log('[adding and removing inside pages]');
    await page.click('.page-tab[data-page="2"]');
    await page.click('#add-page-btn');
    assert('new page inserted after the current inside page', (await tabs()).join() === 'Front cover,Their info,Page 1,Page 2,Back cover');
    assert('new page is on screen', await page.evaluate(() => state.currentPage === 3));
    await page.click('.page-tab[data-page="0"]');
    await page.click('#add-page-btn');
    assert('from a cover tab, inserts after the last inside page', (await tabs()).join() === 'Front cover,Their info,Page 1,Page 2,Page 3,Back cover');
    await page.click('#remove-page-btn');
    assert('remove takes out the current inside page', (await tabs()).length === 5);

    console.log('[24-page cap]');
    for (let i = 0; i < 30; i++) {
        if (await disabled('add-page-btn')) break;
        await page.click('#add-page-btn');
    }
    assert('stops at 24 inside pages', await page.evaluate(() => insideIndexes(state.pages).length === 24));
    assert('+ Page disabled at the cap', await disabled('add-page-btn'));

    console.log('[switching formats]');
    await page.selectOption('#page-format', 'single-page');
    assert('single-page tabs unchanged', (await tabs()).join() === 'Page 1');
    await page.selectOption('#page-format', 'half-letter');
    assert('back to a fresh booklet', (await tabs()).join() === 'Front cover,Their info,Page 1,Back cover');

    await close();
    done();
})();
```

- [ ] **Step 7: Run all checks**

Run the full unit suite, then `node tests/browser/booklet-structure.cjs` (with the env from Global Constraints).
Expected: unit suite prints nothing; browser check ends `N passed, 0 failed` with no `PAGE ERROR` lines.

---

### Task 3: Glenn's info page (`data/organizer.json`, `js/organizer.js`)

**Files:**
- Create: `data/organizer.json`, `js/organizer.js`
- Modify: `index.html` (script tag), `js/store.js` (`state.organizer`, keep it across project load, exclude from project JSON), `js/editor.js` (DOMContentLoaded init), `css/editor.css`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `state.organizer` (parsed JSON or `null`); `buildOrganizerPage(organizer) -> HTMLDivElement` (class `organizer-page`, 528 × 816); `Organizer.init()`.

- [ ] **Step 1: Create the data file**

`data/organizer.json` (Glenn replaces the content; only `name` is required):

```json
{
  "name": "Glenn",
  "role": "",
  "lines": [],
  "links": []
}
```

Optional field `"image": "images/organizer/<file>.png"`.

- [ ] **Step 2: Create `js/organizer.js`**

```js
// organizer.js — Glenn's info page, the inside back cover of every half-letter booklet.
// Content comes from data/organizer.json; participants never edit it. It appears only in
// the Preview's booklet view and in the PDF.

function buildOrganizerPage(organizer) {
    const page = document.createElement('div');
    page.className = 'organizer-page';
    const add = (tag, className, text) => {
        const el = document.createElement(tag);
        el.className = className;
        el.textContent = text;
        page.appendChild(el);
    };

    if (!organizer || typeof organizer.name !== 'string' || !organizer.name.trim()) {
        add('p', 'organizer-missing', 'Organizer info not set');
        return page;
    }
    if (organizer.image) {
        const img = document.createElement('img');
        img.className = 'organizer-image';
        img.src = organizer.image;
        img.alt = '';
        page.appendChild(img);
    }
    add('h2', 'organizer-name', organizer.name);
    if (organizer.role) add('p', 'organizer-role', organizer.role);
    (Array.isArray(organizer.lines) ? organizer.lines : []).forEach(line => add('p', 'organizer-line', line));
    (Array.isArray(organizer.links) ? organizer.links : []).forEach(link => add('p', 'organizer-link', link));
    return page;
}

const Organizer = {
    init: function () {
        fetch('data/organizer.json')
            .then(r => r.json())
            .then(data => { state.organizer = data; })
            .catch(() => { state.organizer = null; });
    }
};
```

- [ ] **Step 3: Wire it up**

`index.html`: add `<script src="js/organizer.js"></script>` after `<script src="js/photos.js"></script>`.

`js/store.js`: add `organizer: null,           // replaced by data/organizer.json at startup` after `photoImages: []` (add the comma to the previous line).

In `exportProjectJSON`, replace `JSON.stringify(state, null, 2)` with:

```js
JSON.stringify(state, (key, value) => (PROJECT_JSON_SKIP.includes(key) ? undefined : value), 2)
```

and add above `exportProjectJSON`:

```js
// Fixed or view-only state that isn't part of a saved project
const PROJECT_JSON_SKIP = ['organizer'];
```

In `importProjectJSON`, change the two lines that wipe and assign state to keep the organizer data:

```js
        const organizer = state.organizer;
        Object.keys(state).forEach(key => delete state[key]);
        Object.assign(state, loaded);
        state.organizer = organizer;
```

`js/editor.js` DOMContentLoaded: add `Organizer.init();` after `Photos.init();`.

`css/editor.css`, append after the `.preview-page-number` rule:

```css
/* Glenn's info page (inside back cover of half-letter booklets) */
.organizer-page {
    width: 528px;
    height: 816px;
    box-sizing: border-box;
    padding: 48px;
    background: #f8f8f0;
    color: #1a1a1a;
    font-family: 'Liberation Mono', monospace;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    overflow: hidden;
}

.organizer-image {
    max-width: 100%;
    max-height: 240px;
    object-fit: contain;
}

.organizer-name {
    font-size: 24px;
    margin: 0;
}

.organizer-role,
.organizer-line,
.organizer-link,
.organizer-missing {
    font-size: 14px;
    margin: 0;
    overflow-wrap: anywhere;
}

.organizer-missing {
    color: #888;
}
```

- [ ] **Step 4: Verify in the browser**

Run (env from Global Constraints):

```bash
node -e "
const { open, assert, done } = require('./tests/browser/harness.cjs');
(async () => {
  const { page, close } = await open();
  await page.waitForFunction(() => state.organizer !== null);
  assert('organizer.json loaded', await page.evaluate(() => state.organizer.name === 'Glenn'));
  assert('page shows the name', await page.evaluate(() => buildOrganizerPage(state.organizer).querySelector('.organizer-name').textContent === 'Glenn'));
  assert('missing data shows the notice', await page.evaluate(() => buildOrganizerPage(null).textContent === 'Organizer info not set'));
  assert('text is not parsed as HTML', await page.evaluate(() => buildOrganizerPage({ name: '<b>x</b>' }).querySelector('b') === null));
  await close(); done();
})();"
```

Expected: `4 passed, 0 failed`. Then run the unit suite and `tests/browser/booklet-structure.cjs` again: still passing.

---

### Task 4: Booklet PDF export

**Files:**
- Create: `tests/browser/booklet-export.cjs`
- Modify: `js/export.js` (replace `generatePDF`), `index.html` (export dialog), `css/editor.css`

**Interfaces:**
- Consumes: Task 1 `bookletSheets`, `sidesInPrintOrder`, `insideIndexes`, `slotPageIndex`; Task 3 `buildOrganizerPage`, `state.organizer`.
- Produces: `chooseBookletMode() -> Promise<'duplex' | 'two-pass' | null>`; `buildBookletPdf(mode) -> Promise<jsPDF>`; `buildSheetPdf() -> Promise<jsPDF>`; `captureEditorPage(index) -> Promise<HTMLCanvasElement>`; `generatePDF()` (same name, called by `editor.js`). Task 8 adds view-rotation save/restore inside `generatePDF`.

- [ ] **Step 1: Write the failing browser check**

Create `tests/browser/booklet-export.cjs`:

```js
// booklet-export.cjs — booklet PDF imposition in both modes, the export dialog, missing organizer data.
'use strict';

const { open, assert, done } = require('./harness.cjs');

(async () => {
    const { page, close } = await open();

    // A booklet with 5 inside pages; every page carries its own label as text so every capture differs.
    // html2canvas and jsPDF.addImage are wrapped to record which page image lands where.
    await page.evaluate(() => {
        state.pages = makeBookletPages(generateId);
        for (let i = 0; i < 4; i++) state.pages.splice(3, 0, { id: generateId(), role: 'inside', elements: [] });
        state.pages.forEach((p, i) => p.elements.push(Object.assign(createTextElement(60, 60), { content: pageLabel(state.pages, i), rotation: 0 })));
        state.currentPage = 3;
        render();

        window.__labels = new Map();
        window.__placed = [];
        const realCapture = window.html2canvas;
        window.html2canvas = async (el, opts) => {
            const canvas = await realCapture(el, opts);
            const label = el.classList.contains('organizer-page') ? "Glenn's info" : pageLabel(state.pages, state.currentPage);
            window.__labels.set(canvas.toDataURL('image/png'), label);
            return canvas;
        };
        const api = window.jspdf.jsPDF.API;
        const realAdd = api.addImage;
        api.addImage = function (img, format, x) {
            window.__placed.push(`${this.getNumberOfPages()}${x === 0 ? 'L' : 'R'} ${window.__labels.get(img)}`);
            return realAdd.apply(this, arguments);
        };
        api.save = function (name) { window.__saved = name; };
    });

    const run = mode => page.evaluate(async mode => {
        window.__placed = [];
        const pdf = await buildBookletPdf(mode);
        return { count: pdf.getNumberOfPages(), w: pdf.internal.pageSize.getWidth(), h: pdf.internal.pageSize.getHeight(), placed: window.__placed };
    }, mode);

    console.log('[double-sided]');
    const duplex = await run('duplex');
    assert('cover sheet + 2 inside sheets = 6 sides', duplex.count === 6);
    assert('pages are 792 x 612 pt', Math.round(duplex.w) === 792 && Math.round(duplex.h) === 612);
    assert('every page lands in the right half, blanks left empty', duplex.placed.join(' / ') === [
        '1L Back cover', '1R Front cover', '2L Their info', "2R Glenn's info",
        '3R Page 1', '4L Page 2', '5R Page 3', '6L Page 4', '6R Page 5'
    ].join(' / '));

    console.log('[two passes]');
    const twoPass = await run('two-pass');
    assert('all fronts, then all backs', twoPass.placed.join(' / ') === [
        '1L Back cover', '1R Front cover', '2R Page 1', '3R Page 3',
        '4L Their info', "4R Glenn's info", '5L Page 2', '6L Page 4', '6R Page 5'
    ].join(' / '));

    console.log('[export dialog]');
    // The direct buildBookletPdf calls above leave the last captured page on screen
    await page.evaluate(() => { state.currentPage = 3; render(); });
    await page.click('#print-btn');
    assert('dialog opens for half-letter', await page.$eval('#booklet-export-modal', el => el.classList.contains('show')));
    await page.click('#booklet-export-modal button[data-mode=""]');
    assert('cancel closes it and saves nothing', await page.evaluate(() => !document.getElementById('booklet-export-modal').classList.contains('show') && !window.__saved));
    await page.click('#print-btn');
    await page.click('#booklet-export-modal button[data-mode="duplex"]');
    await page.waitForFunction(() => window.__saved);
    assert('filename names the mode', await page.evaluate(() => /^zine-booklet-duplex-\d{4}-\d{2}-\d{2}\.pdf$/.test(window.__saved)));
    assert('page on screen restored', await page.evaluate(() => state.currentPage === 3));
    assert('button restored', await page.$eval('#print-btn', b => !b.disabled && b.textContent === 'Save as PDF'));

    console.log('[missing organizer data]');
    const missing = await page.evaluate(async () => {
        state.organizer = null;
        window.__placed = [];
        const pdf = await buildBookletPdf('duplex');
        return { count: pdf.getNumberOfPages(), placed: window.__placed };
    });
    assert('export still completes with Glenn\'s slot filled', missing.count === 6 && missing.placed.includes("2R Glenn's info"));

    console.log('[single-page still exports one sheet]');
    const sheet = await page.evaluate(async () => {
        document.getElementById('page-format').value = 'single-page';
        document.getElementById('page-format').dispatchEvent(new Event('change'));
        const pdf = await buildSheetPdf();
        return pdf.getNumberOfPages();
    });
    assert('one landscape page', sheet === 1);

    await close();
    done();
})();
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tests/browser/booklet-export.cjs`
Expected: `PAGE ERROR` / FAIL — `buildBookletPdf is not defined`.

- [ ] **Step 3: Add the export dialog markup and styles**

`index.html`, after the preview modal's closing `</div>`:

```html
    <!-- Booklet export choice -->
    <div class="preview-modal" id="booklet-export-modal" role="dialog" aria-modal="true" aria-labelledby="booklet-export-title">
        <div class="booklet-export-dialog">
            <h2 id="booklet-export-title">Save booklet as PDF</h2>
            <button class="btn" data-mode="duplex">Double-sided booklet</button>
            <p class="booklet-export-note">Print double-sided, flip on short edge.</p>
            <button class="btn" data-mode="two-pass">No duplex printer</button>
            <p class="booklet-export-note">Print the first half, put the printed stack back in the tray, then print the second half. Try with one sheet first — printers differ in how the stack goes back in.</p>
            <button class="btn btn-tertiary" data-mode="">Cancel</button>
        </div>
    </div>
```

`css/editor.css`, append after the organizer rules:

```css
/* Booklet export choice */
.booklet-export-dialog {
    max-width: 420px;
    margin: 15vh auto 0;
    background: #fdfdfd;
    border-radius: 6px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.booklet-export-dialog h2 {
    margin: 0 0 8px;
    font-size: 16px;
    color: rgb(122, 6, 97);
}

.booklet-export-note {
    margin: 0 0 12px;
    font-size: 12px;
    color: #555;
    line-height: 1.4;
}
```

- [ ] **Step 4: Replace `generatePDF` in `js/export.js`**

Replace everything from `async function generatePDF() {` to the end of that function (just above `const Export = {`) with:

```js
const PAPER_COLOR = '#f8f8f0';
const SHEET_W = 11 * 72;   // letter landscape, in PDF points
const SHEET_H = 8.5 * 72;

function capture(el) {
    return html2canvas(el, { backgroundColor: PAPER_COLOR, scale: 2, useCORS: true, allowTaint: true });
}

async function captureEditorPage(index) {
    state.currentPage = index;
    renderCanvas();
    await new Promise(resolve => setTimeout(resolve, 100));   // let images/fonts settle
    return capture(document.querySelector('.canvas-container'));
}

async function captureOrganizerPage() {
    const page = buildOrganizerPage(state.organizer);
    page.style.position = 'absolute';
    page.style.left = '0';
    page.style.top = '0';
    page.style.zIndex = '-1';
    document.body.appendChild(page);
    try {
        return await capture(page);
    } finally {
        page.remove();
    }
}

// Asks how the booklet will be printed. Resolves 'duplex', 'two-pass', or null (cancelled).
function chooseBookletMode() {
    const modal = document.getElementById('booklet-export-modal');
    modal.classList.add('show');
    return new Promise(resolve => {
        const onClick = (e) => {
            const btn = e.target.closest('button[data-mode]');
            if (!btn && e.target !== modal) return;
            modal.classList.remove('show');
            modal.removeEventListener('click', onClick);
            resolve(btn && btn.dataset.mode ? btn.dataset.mode : null);
        };
        modal.addEventListener('click', onClick);
    });
}

// Half-letter: cover sheet + inside sheets, two pages per landscape side, in print order
async function buildBookletPdf(mode) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [SHEET_W, SHEET_H] });
    const sides = sidesInPrintOrder(bookletSheets(insideIndexes(state.pages).length), mode);
    const images = new Map();   // slot -> PNG data URL, so each page is captured once

    const imageFor = async (slot) => {
        if (slot === null) return null;
        if (!images.has(slot)) {
            const canvas = slot === 'glenn-info'
                ? await captureOrganizerPage()
                : await captureEditorPage(slotPageIndex(state.pages, slot));
            images.set(slot, canvas.toDataURL('image/png'));
        }
        return images.get(slot);
    };

    for (let i = 0; i < sides.length; i++) {
        if (i > 0) pdf.addPage([SHEET_W, SHEET_H], 'landscape');
        for (let half = 0; half < 2; half++) {
            const x = half * SHEET_W / 2;
            const image = await imageFor(sides[i].slots[half]);
            if (image) {
                pdf.addImage(image, 'PNG', x, 0, SHEET_W / 2, SHEET_H);
            } else {
                pdf.setFillColor(PAPER_COLOR);
                pdf.rect(x, 0, SHEET_W / 2, SHEET_H, 'F');
            }
        }
    }
    return pdf;
}

// Single-page and stapled: each sheet as drawn (stapled has one editor page per side)
async function buildSheetPdf() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [SHEET_W, SHEET_H] });
    const indexes = state.pageFormat === 'stapled' ? state.pages.map((_, i) => i) : [state.currentPage];
    for (let i = 0; i < indexes.length; i++) {
        if (i > 0) pdf.addPage([SHEET_W, SHEET_H], 'landscape');
        const canvas = await captureEditorPage(indexes[i]);
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, SHEET_W, SHEET_H);
    }
    return pdf;
}

async function generatePDF() {
    const isBooklet = state.pageFormat === 'half-letter';
    const mode = isBooklet ? await chooseBookletMode() : null;
    if (isBooklet && !mode) return;

    const container = document.querySelector('.canvas-container');
    const btn = document.getElementById('print-btn');
    const saved = { guides: state.guidesVisible, selectedId: state.selectedId, currentPage: state.currentPage };

    // Hide guides and selection boxes while capturing
    container.classList.add('hide-guides');
    state.selectedId = null;
    renderCanvas();
    btn.textContent = 'Generating PDF...';
    btn.disabled = true;

    try {
        const date = new Date().toISOString().slice(0, 10);
        if (isBooklet) {
            (await buildBookletPdf(mode)).save(`zine-booklet-${mode}-${date}.pdf`);
        } else {
            const formatName = state.pageFormat === 'single-page' ? 'single-page-folded' : 'single-page-stapled';
            (await buildSheetPdf()).save(`zine-${formatName}-${date}.pdf`);
        }
    } catch (error) {
        console.error('PDF generation failed:', error);
        alert('Failed to generate PDF. Please try again.');
    } finally {
        if (saved.guides) container.classList.remove('hide-guides');
        state.currentPage = saved.currentPage;
        state.selectedId = saved.selectedId;
        renderCanvas();
        btn.textContent = 'Save as PDF';
        btn.disabled = false;
    }
}
```

- [ ] **Step 5: Run the checks**

Run: `node tests/browser/booklet-export.cjs`, then the unit suite and `tests/browser/booklet-structure.cjs`.
Expected: all `0 failed`, no `PAGE ERROR`.

- [ ] **Step 6: Check one real PDF by eye**

Run in the browser check style (env from Global Constraints) to write a real duplex PDF, then render page 3 to PNG and look at it:

```bash
node -e "
const { open } = require('./tests/browser/harness.cjs');
const fs = require('fs');
(async () => {
  const { page, close } = await open();
  const b64 = await page.evaluate(async () => {
    state.pages = makeBookletPages(generateId);
    state.pages.forEach((p, i) => p.elements.push(Object.assign(createTextElement(60, 60), { content: pageLabel(state.pages, i), fontSize: 40, w: 400, h: 80, rotation: 0 })));
    render();
    const pdf = await buildBookletPdf('duplex');
    return pdf.output('datauristring').split(',')[1];
  });
  fs.writeFileSync('$NODE_PATH/../booklet-check.pdf', Buffer.from(b64, 'base64'));
  await close();
})();"
pdftoppm -png -r 30 "$NODE_PATH/../booklet-check.pdf" "$NODE_PATH/../booklet-check"
```

Open the PNGs with the Read tool. Expected: side 1 shows "Back cover" left and "Front cover" right; side 2 "Their info" left and Glenn's page right; side 3 blank left, "Page 1" right; side 4 blank right. If `pdftoppm` is missing, skip this step and say so.

---

### Task 5: Their-info form

**Files:**
- Create: `js/infoform.js`, `tests/browser/info-and-import.cjs` (info part; Task 6 appends the import part)
- Modify: `index.html` (panel markup, script tag), `js/editor.js` (`render()` calls `InfoForm.render()`; DOMContentLoaded calls `InfoForm.init()`), `css/editor.css`

**Interfaces:**
- Consumes: Task 1 `infoFormLayout`, `replaceInfoFormElements`; Task 2 `state.meta.info`; existing `createTextElement`, `getCurrentPage`, `render`, `Autosave.schedule`.
- Produces: `InfoForm.init()`, `InfoForm.render()`, `InfoForm.fill()`; elements created by the form carry `fromInfoForm: true`.

- [ ] **Step 1: Write the failing browser check**

Create `tests/browser/info-and-import.cjs`:

```js
// info-and-import.cjs — the their-info form, and importing pages from other projects.
'use strict';

const { open, assert, done } = require('./harness.cjs');

(async () => {
    const { page, close } = await open();
    const panelHidden = () => page.$eval('#info-form-panel', el => el.hidden);

    console.log('[info form]');
    assert('hidden on the front cover', await panelHidden());
    await page.click('.page-tab[data-page="1"]');
    assert('shown on the their-info tab', !(await panelHidden()));
    assert('date defaults to today', (await page.inputValue('#info-date')).length > 0);

    await page.fill('#info-name', 'Ana');
    await page.fill('#info-note', 'I live here');
    await page.click('#info-fill-btn');
    const first = await page.evaluate(() => getCurrentPage().elements.map(e => ({ content: e.content, form: !!e.fromInfoForm })));
    assert('creates text elements for filled fields', first.map(e => e.content).join('|') === `Ana|${first[1].content}|I live here` && first.every(e => e.form));

    await page.evaluate(() => {
        getCurrentPage().elements[0].content = 'Ana R.';   // participant edits a form element
        getCurrentPage().elements.push(Object.assign(createTextElement(300, 600), { content: 'my doodle' }));
        render();
    });
    await page.fill('#info-name', 'Bo');
    await page.click('#info-fill-btn');
    const second = await page.evaluate(() => getCurrentPage().elements.map(e => e.content));
    assert('refill replaces form elements, keeps the participant\'s own', second[0] === 'my doodle' && second.includes('Bo') && !second.includes('Ana R.'));
    assert('form values stored in meta.info', await page.evaluate(() => state.meta.info.name === 'Bo'));

    await page.selectOption('#page-format', 'single-page');
    assert('hidden for single-page', await panelHidden());
    await page.selectOption('#page-format', 'half-letter');

    await close();
    done();
})();
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tests/browser/info-and-import.cjs`
Expected: failure — `#info-form-panel` not found.

- [ ] **Step 3: Add the panel markup**

`index.html`, inside `<div class="right-panel">`, before `<div class="properties-panel" id="properties-panel">`:

```html
            <div class="info-form-panel" id="info-form-panel" hidden>
                <h3>Your info</h3>
                <label for="info-name">Name</label>
                <input type="text" id="info-name" class="property-input">
                <label for="info-contact">Contact</label>
                <input type="text" id="info-contact" class="property-input">
                <label for="info-date">Date</label>
                <input type="text" id="info-date" class="property-input">
                <label for="info-note">Note</label>
                <textarea id="info-note" class="property-input" rows="4"></textarea>
                <button class="tool-btn" id="info-fill-btn">Fill in page</button>
            </div>
```

Add `<script src="js/infoform.js"></script>` after `<script src="js/organizer.js"></script>`.

`css/editor.css`, append:

```css
/* Their-info form (half-letter booklets) */
.info-form-panel {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px;
    border-bottom: 1px solid rgba(122, 6, 97, 0.1);
}

.info-form-panel[hidden] {
    display: none;
}

.info-form-panel label {
    font-size: 11px;
    color: #555;
}

.info-form-panel .tool-btn {
    margin-top: 8px;
}
```

- [ ] **Step 4: Create `js/infoform.js`**

```js
// infoform.js — the "Their info" page form for half-letter booklets. Values live in
// state.meta.info (autosaved and saved with the project). "Fill in page" turns them into
// ordinary text elements tagged fromInfoForm; filling in again replaces only those.

const InfoForm = {
    FIELDS: ['name', 'contact', 'date', 'note'],

    info: function () {
        if (!state.meta.info || typeof state.meta.info !== 'object') state.meta.info = {};
        return state.meta.info;
    },

    init: function () {
        InfoForm.FIELDS.forEach(field => {
            document.getElementById('info-' + field).addEventListener('input', (e) => {
                InfoForm.info()[field] = e.target.value;
                Autosave.schedule();
            });
        });
        document.getElementById('info-fill-btn').addEventListener('click', InfoForm.fill);
    },

    render: function () {
        const panel = document.getElementById('info-form-panel');
        const page = getCurrentPage();
        panel.hidden = !(state.pageFormat === 'half-letter' && page && page.role === 'their-info');
        if (panel.hidden) return;

        const info = InfoForm.info();
        if (!info.date) info.date = new Date().toLocaleDateString();
        InfoForm.FIELDS.forEach(field => {
            const input = document.getElementById('info-' + field);
            if (document.activeElement !== input) input.value = info[field] || '';
        });
    },

    fill: function () {
        const page = getCurrentPage();
        page.elements = replaceInfoFormElements(page.elements || [], infoFormLayout(InfoForm.info()), spec =>
            Object.assign(createTextElement(spec.x, spec.y), {
                w: spec.w, h: spec.h, fontSize: spec.fontSize, bold: spec.bold,
                content: spec.content, rotation: 0, fromInfoForm: true
            }));
        state.selectedId = null;
        state.editingId = null;
        render();
    }
};
```

- [ ] **Step 5: Hook into `render()` and startup**

`js/editor.js`, in `render()`, add `InfoForm.render();` after `renderPageTabs();`. In the DOMContentLoaded handler add `InfoForm.init();` after `Export.init();`.

- [ ] **Step 6: Run the checks**

Run: `node tests/browser/info-and-import.cjs`, the unit suite, and the earlier browser checks.
Expected: all `0 failed`.

---

### Task 6: Import pages (group zines)

**Files:**
- Modify: `index.html` (button + file input), `js/export.js` (`Export.init` wiring), `js/editor.js` (`updateToolStates` shows the button only for half-letter), `tests/browser/info-and-import.cjs` (append import checks)

**Interfaces:**
- Consumes: Task 1 `importInsidePages`, `importSummary`, `insideIndexes`; existing `generateId`, `render`, `Autosave.showNotice`.
- Produces: `#import-pages-btn`, `#import-pages-input`.

- [ ] **Step 1: Append the failing import checks**

In `tests/browser/info-and-import.cjs`, insert before `await close();`:

```js
    console.log('[import pages]');
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zine-import-'));
    const file = (name, data) => { const p = path.join(dir, name); fs.writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data)); return p; };
    const friend = file('friend.json', { pageFormat: 'half-letter', pages: [
        { id: 1, role: 'front-cover', elements: [] },
        { id: 2, role: 'inside', elements: [{ id: 5, type: 'text', x: 10, y: 10, w: 100, h: 40, rotation: 0, content: 'F1' }] },
        { id: 3, role: 'inside', elements: [{ id: 6, type: 'text', x: 10, y: 10, w: 100, h: 40, rotation: 0, content: 'F2' }] },
        { id: 4, role: 'back-cover', elements: [] }
    ] });
    const sheet = file('sheet.json', { pageFormat: 'single-page', pages: [{ id: 1, elements: [] }] });
    const broken = file('broken.json', '{ not json');

    assert('button shown for half-letter', !(await page.$eval('#import-pages-btn', b => b.hidden)));
    await page.setInputFiles('#import-pages-input', [friend, sheet, broken]);
    await page.waitForSelector('#save-notice');
    const notice = await page.$eval('#save-notice', n => n.textContent);
    assert('notice reports pages and names the skipped files', notice.includes('Imported 2 pages') && notice.includes('sheet.json') && notice.includes('broken.json'));
    assert('imported pages appended as inside pages', (await page.$$eval('.page-tab', els => els.map(e => e.textContent))).join() ===
        'Front cover,Their info,Page 1,Page 2,Page 3,Back cover');

    await page.evaluate(() => { while (insideIndexes(state.pages).length < 23) state.pages.splice(3, 0, { id: generateId(), role: 'inside', elements: [] }); render(); });
    await page.evaluate(() => document.getElementById('save-notice')?.remove());
    await page.setInputFiles('#import-pages-input', [friend]);
    await page.waitForSelector('#save-notice');
    assert('stops at 24 and reports the skipped page', (await page.$eval('#save-notice', n => n.textContent)).includes('skipped 1 (24-page limit)'));
    assert('24 inside pages', await page.evaluate(() => insideIndexes(state.pages).length === 24));

    await page.selectOption('#page-format', 'single-page');
    assert('button hidden for single-page', await page.$eval('#import-pages-btn', b => b.hidden));
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tests/browser/info-and-import.cjs`
Expected: failure — `#import-pages-btn` not found.

- [ ] **Step 3: Add the markup**

`index.html`, after `<input type="file" id="load-json-input" ...>`:

```html
                <button class="btn btn-secondary" id="import-pages-btn" title="Add the inside pages from other saved projects (group zines)">Import Pages</button>
                <input type="file" id="import-pages-input" accept="application/json" multiple style="display: none;">
```

- [ ] **Step 4: Wire it in `Export.init`**

In `js/export.js`, inside `Export.init`, after the `if (loadBtn && loadInput) { ... }` block:

```js
        const importBtn = document.getElementById('import-pages-btn');
        const importInput = document.getElementById('import-pages-input');
        if (importBtn && importInput) {
            importBtn.addEventListener('click', () => importInput.click());
            importInput.addEventListener('change', async (e) => {
                const files = Array.from(e.target.files);
                importInput.value = '';
                if (!files.length) return;

                const projects = [];
                const unreadable = [];
                for (const file of files) {
                    try {
                        projects.push({ name: file.name, data: JSON.parse(await file.text()) });
                    } catch (error) {
                        unreadable.push(file.name);
                    }
                }
                const result = importInsidePages(state.pages, projects, generateId);
                state.pages = result.pages;
                state.selectedId = null;
                state.editingId = null;
                render();
                Autosave.showNotice(importSummary(result, unreadable));
            });
        }
```

- [ ] **Step 5: Show the button only for half-letter**

`js/editor.js`, at the end of `updateToolStates`:

```js
            const importBtn = document.getElementById('import-pages-btn');
            if (importBtn) importBtn.hidden = state.pageFormat !== 'half-letter';
```

- [ ] **Step 6: Run the checks**

Run: `node tests/browser/info-and-import.cjs`, the unit suite, and the other browser checks.
Expected: all `0 failed`.

---

### Task 7: Preview modal booklet view

**Files:**
- Create: `tests/browser/booklet-preview.cjs`
- Modify: `index.html` (toggle markup), `js/editor.js` (`openDigitalPreview` refactor ~line 1868, toggle listener in `initializeEventListeners`), `css/editor.css`

**Interfaces:**
- Consumes: Task 1 `bookletSheets`, `insideIndexes`, `pageLabel`, `slotLabel`, `slotPageIndex`; Task 3 `buildOrganizerPage`.
- Produces: `buildPreviewPage(page) -> HTMLDivElement` (528 × 816 `.preview-page`); module-level `previewView` (`'reading' | 'booklet'`).

- [ ] **Step 1: Write the failing browser check**

Create `tests/browser/booklet-preview.cjs`:

```js
// booklet-preview.cjs — Preview modal: reading order and booklet sheets for half-letter.
'use strict';

const { open, assert, done } = require('./harness.cjs');

(async () => {
    const { page, close } = await open();
    await page.evaluate(() => {
        state.pages = makeBookletPages(generateId);
        for (let i = 0; i < 4; i++) state.pages.splice(3, 0, { id: generateId(), role: 'inside', elements: [] });
        render();
    });
    const captions = () => page.$$eval('#preview-pages .preview-page-number', els => els.map(e => e.textContent));

    console.log('[reading order]');
    await page.click('#preview-btn');
    assert('toggle shown for half-letter', !(await page.$eval('#preview-view-toggle', el => el.hidden)));
    assert('reading order with Glenn after their info', (await captions()).join() ===
        "Front cover,Their info,Glenn's info,Page 1,Page 2,Page 3,Page 4,Page 5,Back cover");

    console.log('[booklet sheets]');
    await page.click('#preview-view-toggle button[data-view="booklet"]');
    const titles = await page.$$eval('#preview-pages .preview-sheet-title', els => els.map(e => e.textContent));
    assert('3 sheets x 2 sides', titles.join() === 'Sheet 1 — front,Sheet 1 — back,Sheet 2 — front,Sheet 2 — back,Sheet 3 — front,Sheet 3 — back');
    assert('halves captioned in print order', (await captions()).join() ===
        "Back cover,Front cover,Their info,Glenn's info,Blank,Page 1,Page 2,Blank,Blank,Page 3,Page 4,Page 5");
    assert('booklet view stays chosen after reopening', await page.evaluate(() => {
        closeDigitalPreview();
        openDigitalPreview();
        return document.querySelectorAll('#preview-pages .preview-spread').length === 6;
    }));

    console.log('[other formats]');
    await page.evaluate(() => closeDigitalPreview());
    await page.selectOption('#page-format', 'single-page');
    await page.click('#preview-btn');
    assert('toggle hidden and plain pages shown', await page.$eval('#preview-view-toggle', el => el.hidden) && (await captions()).join() === 'Page 1');

    await close();
    done();
})();
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tests/browser/booklet-preview.cjs`
Expected: failure — `#preview-view-toggle` not found.

- [ ] **Step 3: Add the toggle markup and styles**

`index.html`, after `<div class="preview-header">Digital Preview - All Pages</div>`:

```html
            <div class="preview-view-toggle" id="preview-view-toggle" hidden>
                <button class="btn btn-secondary" data-view="reading">Reading order</button>
                <button class="btn btn-secondary" data-view="booklet">Booklet sheets</button>
            </div>
```

`css/editor.css`, append:

```css
/* Preview: reading order / booklet sheets */
.preview-view-toggle {
    display: flex;
    justify-content: center;
    gap: 8px;
}

.preview-view-toggle[hidden] {
    display: none;
}

.preview-view-toggle .btn.active {
    background: rgb(122, 6, 97);
    color: white;
}

.preview-sheet-title {
    color: white;
    text-align: center;
    font-size: 14px;
}

/* A printed side: two 528px pages side by side, shrunk to fit the 600px preview column */
.preview-spread {
    display: flex;
    zoom: 0.55;
    margin: 0 auto;
}

.preview-spread-half .preview-page-number {
    font-size: 20px;
}

.preview-blank {
    background: #f8f8f0;
    opacity: 0.4;
}
```

- [ ] **Step 4: Refactor `openDigitalPreview`**

In `js/editor.js`, replace the whole `openDigitalPreview` function with the following. `buildPreviewPage` holds the element-building code that used to sit inside the `state.pages.forEach` loop — move that code across **unchanged** (from `const allElements = [];` through the `allElements.forEach(element => { ... pageDiv.appendChild(elementDiv); });` block), only wrapping it:

```js
        let previewView = 'reading';

        // One page as it will print (528 x 816), built from its elements
        function buildPreviewPage(page) {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'preview-page';

            // ← moved unchanged from the old loop body: `const allElements = [];` …
            //   through the `allElements.forEach(element => { … pageDiv.appendChild(elementDiv); });` block

            return pageDiv;
        }

        function previewSlot(slot) {
            if (slot === 'glenn-info') return buildOrganizerPage(state.organizer);
            const index = slotPageIndex(state.pages, slot);
            if (index === null) {
                const blank = document.createElement('div');
                blank.className = 'preview-page preview-blank';
                return blank;
            }
            return buildPreviewPage(state.pages[index]);
        }

        function captioned(pageEl, caption) {
            const wrap = document.createElement('div');
            wrap.appendChild(pageEl);
            const label = document.createElement('div');
            label.className = 'preview-page-number';
            label.textContent = caption;
            wrap.appendChild(label);
            return wrap;
        }

        function renderReadingPreview(container) {
            const isBooklet = state.pageFormat === 'half-letter';
            state.pages.forEach((page, index) => {
                container.appendChild(captioned(buildPreviewPage(page), pageLabel(state.pages, index)));
                if (isBooklet && page.role === 'their-info') {
                    container.appendChild(captioned(previewSlot('glenn-info'), slotLabel('glenn-info')));
                }
            });
        }

        function renderBookletPreview(container) {
            bookletSheets(insideIndexes(state.pages).length).forEach((sheet, i) => {
                ['front', 'back'].forEach(side => {
                    const title = document.createElement('div');
                    title.className = 'preview-sheet-title';
                    title.textContent = `Sheet ${i + 1} — ${side}`;
                    container.appendChild(title);

                    const spread = document.createElement('div');
                    spread.className = 'preview-spread';
                    sheet[side].forEach(slot => {
                        const half = captioned(previewSlot(slot), slotLabel(slot));
                        half.className = 'preview-spread-half';
                        spread.appendChild(half);
                    });
                    container.appendChild(spread);
                });
            });
        }

        // Digital Preview System
        function openDigitalPreview() {
            const modal = document.getElementById('preview-modal');
            const container = document.getElementById('preview-pages');
            const toggle = document.getElementById('preview-view-toggle');
            const isBooklet = state.pageFormat === 'half-letter';

            toggle.hidden = !isBooklet;
            if (!isBooklet) previewView = 'reading';
            toggle.querySelectorAll('button').forEach(btn => btn.classList.toggle('active', btn.dataset.view === previewView));

            container.innerHTML = '';
            if (previewView === 'booklet') {
                renderBookletPreview(container);
            } else {
                renderReadingPreview(container);
            }

            modal.classList.add('show');
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }
```

Note: for single-page/stapled, `pageLabel` returns `Page N` for pages without a role, so captions match today's `Page ${index + 1}`. The new `<div>` wrapper per page sits inside `.preview-container`'s 40 px flex gap, which keeps the existing spacing between pages.

- [ ] **Step 5: Toggle listener**

In `initializeEventListeners`, after the preview-btn listener:

```js
            document.getElementById('preview-view-toggle').addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-view]');
                if (!btn) return;
                previewView = btn.dataset.view;
                openDigitalPreview();
            });
```

- [ ] **Step 6: Run the checks**

Run: `node tests/browser/booklet-preview.cjs`, the unit suite and all other browser checks.
Expected: all `0 failed`. Also take a screenshot of the booklet view (`await page.screenshot({ path: '<scratchpad>/preview.png' })` in a one-off script) and look at it with the Read tool: spreads fit the column, two pages side by side, captions readable.

---

### Task 8: View rotation for single-page and stapled sheets

**Files:**
- Create: `js/rotation.test.js`, `tests/browser/rotation.cjs`
- Modify: `js/store.js` (`state.viewRotation`, `screenToSheet`, `PROJECT_JSON_SKIP`, `importProjectJSON`), `js/autosave.js` (`apply`, `startNew` reset), `index.html` (rotator wrapper, buttons), `css/editor.css` (`.canvas-area`/`.canvas-container`/`.canvas-rotator`, mobile rule), `js/editor.js` (`updateCanvasFormat`, format switch, pointer handlers ~1025–1300, button listeners), `js/export.js` (`generatePDF` resets rotation while capturing)

**Interfaces:**
- Consumes: Task 4 `generatePDF` structure (`saved` object, `finally` block).
- Produces: `state.viewRotation` (0 | 90 | 180 | 270); `screenToSheet(dx, dy, rotation, sheetW, sheetH) -> { x, y }`; editor globals `sheetSize()`, `applyViewRotation()`, `setViewRotation(deg)`, `clientToSheet(clientX, clientY)`.

- [ ] **Step 1: Write the failing unit test**

Create `js/rotation.test.js`:

```js
/**
 * rotation.test.js — Node.js test for screenToSheet in store.js (view rotation maths).
 * Loads the real booklet.js + store.js into a sandbox. No DOM required.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}

const sandbox = { Date, Math, JSON, Object, Array };
vm.createContext(sandbox);
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
vm.runInContext(read('booklet.js') + '\n' + read('store.js') + '\nthis.screenToSheet = screenToSheet; this.state = state;', sandbox);
const { screenToSheet } = sandbox;
const W = 1056, H = 816;
const at = (dx, dy, r) => { const p = screenToSheet(dx, dy, r, W, H); return `${p.x},${p.y}`; };

console.log('[centre maps to centre]');
assert('every angle', [0, 90, 180, 270].every(r => at(0, 0, r) === `${W / 2},${H / 2}`));

console.log('[moving right on screen]');
assert('0°: right on the sheet', at(10, 0, 0) === `${W / 2 + 10},${H / 2}`);
assert('90°: up on the sheet', at(10, 0, 90) === `${W / 2},${H / 2 - 10}`);
assert('180°: left on the sheet', at(10, 0, 180) === `${W / 2 - 10},${H / 2}`);
assert('270°: down on the sheet', at(10, 0, 270) === `${W / 2},${H / 2 + 10}`);

console.log('[moving down on screen]');
assert('90°: right on the sheet', at(0, 10, 90) === `${W / 2 + 10},${H / 2}`);
assert('180°: up on the sheet', at(0, 10, 180) === `${W / 2},${H / 2 - 10}`);

console.log('[screen corner of a 90° sheet is the sheet\'s top-left]');
// At 90° clockwise the sheet's top-left corner is drawn at the screen box's top-right
assert('top-right of the rotated box', at(H / 2, -W / 2, 90) === '0,0');

console.log('[state]');
assert('viewRotation starts at 0', sandbox.state.viewRotation === 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run to verify it fails**

Run: `node js/rotation.test.js`
Expected: crash — `screenToSheet is not defined`.

- [ ] **Step 3: Add `screenToSheet` and state**

`js/store.js`: in the `state` literal add `viewRotation: 0,      // view-only (single-page/stapled), never saved` after `guidesVisible: true,`. Add after `randomRotation()`:

```js
// View rotation: maps a screen offset (dx, dy) from the centre of the rotated sheet to
// unrotated sheet coordinates. rotation is a multiple of 90 (degrees clockwise); cos/sin
// are rounded so results are exact.
function screenToSheet(dx, dy, rotation, sheetW, sheetH) {
    const rad = -rotation * Math.PI / 180;
    const cos = Math.round(Math.cos(rad));
    const sin = Math.round(Math.sin(rad));
    return { x: sheetW / 2 + dx * cos - dy * sin, y: sheetH / 2 + dx * sin + dy * cos };
}
```

Change `const PROJECT_JSON_SKIP = ['organizer'];` to `const PROJECT_JSON_SKIP = ['organizer', 'viewRotation'];`. In `importProjectJSON`, after `state.organizer = organizer;` add `state.viewRotation = 0;`.

`js/autosave.js`: in `apply` add `state.viewRotation = 0;` after `state.resizeState = null;`; in `startNew` add `state.viewRotation = 0;` after `state.editingId = null;`.

- [ ] **Step 4: Run unit tests**

Run: `node js/rotation.test.js` and the full unit suite.
Expected: `0 failed`; suite prints nothing.

- [ ] **Step 5: Write the failing browser check**

Create `tests/browser/rotation.cjs`:

```js
// rotation.cjs — single-page view rotation: buttons, dragging moves with the mouse at every
// angle, and export captures the sheet unrotated.
'use strict';

const { open, assert, done } = require('./harness.cjs');

(async () => {
    const { page, close } = await open();
    const hidden = id => page.$eval('#' + id, b => b.hidden);

    console.log('[buttons]');
    assert('hidden for half-letter', await hidden('rotate-right-btn') && await hidden('rotate-left-btn'));
    await page.selectOption('#page-format', 'single-page');
    assert('shown for single-page', !(await hidden('rotate-right-btn')));

    await page.evaluate(() => {
        addElement(Object.assign(createTextElement(300, 300), { content: 'drag me', rotation: 0 }));
        state.selectedId = null;
        render();
    });
    const id = await page.evaluate(() => getCurrentPage().elements[0].id);
    const box = () => page.$eval(`[data-element-id="${id}"]`, el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });

    for (const angle of [0, 90, 180, 270]) {
        console.log(`[${angle}°]`);
        await page.evaluate(a => setViewRotation(a), angle);
        assert('state and transform agree', await page.evaluate(a => state.viewRotation === a &&
            document.querySelector('.canvas-container').style.transform === (a ? `rotate(${a}deg)` : ''), angle));
        const area = await page.$eval('.canvas-area', el => ({ w: el.scrollWidth, h: el.scrollHeight }));
        const rotator = await page.$eval('#canvas-rotator', el => ({ w: el.offsetWidth, h: el.offsetHeight }));
        assert('rotator sized to the turned sheet', angle % 180 ? rotator.w === 816 && rotator.h === 1056 : rotator.w === 1056 && rotator.h === 816);
        assert('whole sheet reachable by scrolling', area.w >= rotator.w && area.h >= rotator.h);

        await page.$eval('.canvas-area', el => { el.scrollTop = 0; el.scrollLeft = 0; });
        await page.$eval(`[data-element-id="${id}"]`, el => el.scrollIntoView({ block: 'center', inline: 'center' }));
        const before = await box();
        await page.mouse.move(before.x, before.y);
        await page.mouse.down();
        await page.mouse.move(before.x + 20, before.y + 15, { steps: 4 });
        await page.mouse.move(before.x + 40, before.y + 30, { steps: 4 });
        await page.mouse.up();
        const after = await box();
        assert(`drag follows the mouse on screen (moved ${Math.round(after.x - before.x)},${Math.round(after.y - before.y)})`,
            Math.abs(after.x - before.x - 40) <= 2 && Math.abs(after.y - before.y - 30) <= 2);
    }

    console.log('[buttons step 90°]');
    await page.evaluate(() => setViewRotation(0));
    await page.click('#rotate-right-btn');
    assert('right = 90', await page.evaluate(() => state.viewRotation === 90));
    await page.click('#rotate-left-btn');
    await page.click('#rotate-left-btn');
    assert('left twice = 270', await page.evaluate(() => state.viewRotation === 270));

    console.log('[export captures the sheet unrotated]');
    const seen = await page.evaluate(async () => {
        setViewRotation(90);
        const transforms = [];
        const real = window.html2canvas;
        window.html2canvas = (el, opts) => { transforms.push(el.style.transform); return real(el, opts); };
        window.jspdf.jsPDF.API.save = function () {};
        await generatePDF();
        window.html2canvas = real;
        return { transforms, after: state.viewRotation };
    });
    assert('captured with no rotation', seen.transforms.length === 1 && seen.transforms[0] === '');
    assert('rotation restored afterwards', seen.after === 90);

    console.log('[resets]');
    await page.selectOption('#page-format', 'stapled');
    assert('format change resets to 0', await page.evaluate(() => state.viewRotation === 0));
    assert('not in project JSON', await page.evaluate(() => {
        setViewRotation(180);
        return !JSON.stringify(state, (k, v) => (PROJECT_JSON_SKIP.includes(k) ? undefined : v)).includes('viewRotation');
    }));

    await close();
    done();
})();
```

- [ ] **Step 6: Run to verify it fails**

Run: `node tests/browser/rotation.cjs`
Expected: failure — `#rotate-right-btn` not found.

- [ ] **Step 7: Markup and CSS**

`index.html`: wrap the canvas container:

```html
        <div class="canvas-area">
            <div class="canvas-rotator" id="canvas-rotator">
                <div class="canvas-container">
                    <div class="canvas-guides"></div>
                    <div class="canvas-content" id="canvas-content">
                        <!-- Elements will be rendered here -->
                    </div>
                </div>
            </div>
        </div>
```

After the `toggle-guides-btn` button:

```html
                <button class="btn btn-tertiary" id="rotate-left-btn" title="Rotate sheet view left">⟲ Rotate left</button>
                <button class="btn btn-tertiary" id="rotate-right-btn" title="Rotate sheet view right">⟳ Rotate right</button>
```

`css/editor.css`: in the `.canvas-container` rule (base, not print) replace

```css
    margin: 20px;
    /* Page is a fixed print size: never let the flex column squash it when
       the viewport is short (e.g. browser zoomed in). */
    flex-shrink: 0;
}
```

with

```css
    /* Placed and turned inside .canvas-rotator by applyViewRotation() */
    position: absolute;
    transform-origin: center center;
}

/* Box the size of the sheet as currently turned, so the canvas area centres and scrolls it */
.canvas-rotator {
    position: relative;
    margin: 20px;
    /* Page is a fixed print size: never let the flex column squash it when
       the viewport is short (e.g. browser zoomed in). */
    flex-shrink: 0;
}
```

and delete the now-duplicate `position: relative;` line at the top of the base `.canvas-container` rule. In the `@media (max-width: 600px)` block add:

```css
    .canvas-rotator {
        width: auto !important;
        height: auto !important;
    }

    .canvas-container {
        position: relative;
        left: 0 !important;
        top: 0 !important;
    }
```

- [ ] **Step 8: Rotation helpers in `js/editor.js`**

Add after `renderPanelGuides()`:

```js
        // ── View rotation (single-page/stapled; view-only, never saved) ──────────

        function sheetSize() {
            return state.pageFormat === 'half-letter' ? { w: 528, h: 816 } : { w: 1056, h: 816 };
        }

        function applyViewRotation() {
            const rotator = document.getElementById('canvas-rotator');
            const container = document.querySelector('.canvas-container');
            const { w, h } = sheetSize();
            const rotation = state.viewRotation || 0;
            const sideways = rotation === 90 || rotation === 270;
            const boxW = sideways ? h : w;
            const boxH = sideways ? w : h;

            rotator.style.width = boxW + 'px';
            rotator.style.height = boxH + 'px';
            container.style.left = (boxW - w) / 2 + 'px';
            container.style.top = (boxH - h) / 2 + 'px';
            container.style.transform = rotation ? `rotate(${rotation}deg)` : '';

            const rotatable = state.pageFormat !== 'half-letter';
            document.getElementById('rotate-left-btn').hidden = !rotatable;
            document.getElementById('rotate-right-btn').hidden = !rotatable;
            document.getElementById('rotate-left-btn').title = `Rotate sheet view left (now ${rotation}°)`;
            document.getElementById('rotate-right-btn').title = `Rotate sheet view right (now ${rotation}°)`;
        }

        function setViewRotation(deg) {
            state.viewRotation = ((deg % 360) + 360) % 360;
            applyViewRotation();
        }

        // Pointer position -> unrotated sheet coordinates. The centre of the sheet's on-screen
        // box doesn't move when it turns, so offsets are measured from there.
        function clientToSheet(clientX, clientY) {
            const rect = document.getElementById('canvas-content').getBoundingClientRect();
            const { w, h } = sheetSize();
            return screenToSheet(clientX - (rect.left + rect.width / 2), clientY - (rect.top + rect.height / 2),
                state.viewRotation || 0, w, h);
        }
```

At the end of `updateCanvasFormat()` add `applyViewRotation();`. In the format switch handler add `state.viewRotation = 0;` next to `state.currentPage = 0;`. In `initializeEventListeners`, after the toggle-guides listener:

```js
            document.getElementById('rotate-left-btn').addEventListener('click', () => setViewRotation(state.viewRotation - 90));
            document.getElementById('rotate-right-btn').addEventListener('click', () => setViewRotation(state.viewRotation + 90));
```

- [ ] **Step 9: Route every pointer position through `clientToSheet`**

Element rotation angles computed from sheet coordinates are already in the sheet's frame, so the Alt-drag and rotate-handle maths need no extra angle offset.

In `handleMouseDown`, replace

```js
            const canvasRect = document.getElementById('canvas-content').getBoundingClientRect();
```

with

```js
            const start = clientToSheet(e.clientX, e.clientY);
```

(keep the comment above it but change "Measure before render()" wording to: `// Measure before render(), which rebuilds the canvas DOM`), and in `state.dragState` replace the four lines `offsetX` … `canvasTop` with:

```js
                // Offset from the element's own x/y, not its (rotated) bounding box
                offsetX: start.x - element.x,
                offsetY: start.y - element.y,
```

In `handleMouseMove`: change the destructuring to

```js
            const { elementId, offsetX, offsetY, startX, startY,
                    startRotation, elementCenterX, elementCenterY, isRotationMode } = state.dragState;
```

add `const pointer = clientToSheet(e.clientX, e.clientY);` after the `if (!element) return;` line; in the rotation branch replace the two `canvasX`/`canvasY` lines and the `dx`/`dy` lines with

```js
                const dx = pointer.x - elementCenterX;
                const dy = pointer.y - elementCenterY;
```

and in the position branch replace `newX`/`newY` with

```js
                const newX = pointer.x - offsetX;
                const newY = pointer.y - offsetY;
```

In `handleResizeStart`: delete the `const canvasRect = ...` line; after `clientY` is computed add `const start = clientToSheet(clientX, clientY);`; in `state.resizeState` set `startX: start.x, startY: start.y,` and delete the `canvasLeft`/`canvasTop` lines.

In `handleResizeMove`: remove `canvasLeft, canvasTop,` from the destructuring; after `if (!element) return;` add `const pointer = clientToSheet(clientX, clientY);`; in the rotating branch replace the `canvasX`/`canvasY`/`dx`/`dy` lines with

```js
                const dx = pointer.x - elementCenterX;
                const dy = pointer.y - elementCenterY;
```

and in the resize branch replace `deltaX`/`deltaY` with

```js
                const deltaX = pointer.x - startX;
                const deltaY = pointer.y - startY;
```

Then confirm nothing still uses the old fields: `grep -n 'canvasLeft\|canvasTop\|canvasRect' js/editor.js` must print nothing.

- [ ] **Step 10: Export captures unrotated**

`js/export.js`, in `generatePDF`: add `rotation: state.viewRotation` to the `saved` object; add `setViewRotation(0);` right after `container.classList.add('hide-guides');`; in `finally` add `setViewRotation(saved.rotation);` after `state.selectedId = saved.selectedId;`.

- [ ] **Step 11: Run all checks**

Run: the unit suite, then every browser check: `booklet-structure`, `booklet-export`, `info-and-import`, `booklet-preview`, `rotation`. Re-run the zoom check from the earlier session as a regression: the page must stay 528 × 816 / 1056 × 816 at 67–200% zoom (the `zoom.mjs` script in the scratchpad, after changing its selector from `.canvas-container` to `#canvas-rotator`).
Expected: everything `0 failed`, no `PAGE ERROR`, zoom sizes constant.

---

### Task 9: README and final verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: docs only.

- [ ] **Step 1: Document**

Add to `README.md` (after the existing data-file sections, before the "No build step" section):

```markdown
## Half-letter booklets

A half-letter zine is a booklet: front cover, the participant's info page, 1–24 inside
pages, and the back cover. "Save as PDF" asks how it will be printed:

- **Double-sided booklet** — print double-sided, flip on short edge.
- **No duplex printer** — the PDF holds all fronts, then all backs. Print the first
  half, put the stack back in the tray, print the second half.

Sheet 1 is the cover sheet (`Back cover | Front cover`, then `Their info | Glenn's info`);
the inside pages follow in booklet order, padded with blank pages to a multiple of 4.
"Import Pages" adds the inside pages from other saved projects, for group zines.

### Organizer info (`data/organizer.json`)

The inside back cover of every booklet. Participants can't edit it.

    {
      "name": "required",
      "role": "optional line under the name",
      "lines": ["optional lines of text"],
      "links": ["optional links, printed as text"],
      "image": "optional path, e.g. images/organizer/logo.png"
    }

## Browser checks

`tests/browser/*.cjs` drive the real page in headless Chromium with Playwright:

    NODE_PATH=/path/to/node_modules CHROME_PATH=/path/to/chrome node tests/browser/booklet-export.cjs

`NODE_PATH` must contain `playwright`; `CHROME_PATH` is only needed when Playwright's
own browser isn't installed. The page loads html2canvas and jsPDF from cdnjs, so these
need network access.
```

- [ ] **Step 2: Final verification**

Run the full unit suite and all five browser checks once more. Then `git status --short` and confirm the changed/new files match the File Structure table (plus the earlier `css/editor.css` zoom fix and the spec/plan docs). Nothing staged, nothing committed.
