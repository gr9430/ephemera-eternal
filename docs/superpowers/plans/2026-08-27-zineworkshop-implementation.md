# Anti-Gentrification Workshop Zine Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/transfer/zineworkshop/` — a standalone, Jekyll-free fork of `tools/ziner/` that adds an optional Tracery-style poetry generator panel and a curated image gallery panel to the existing zine canvas, for Glenn's anti-gentrification workshop.

**Architecture:** Split Ziner's current single-file `index.html` into a global `state` object + helpers (`js/store.js`), the ported canvas editor (`js/editor.js`), a ported PDF/print exporter plus new JSON save/load (`js/export.js`), a Tracery engine ported from slieve-gullion (`js/tracery.js`), a new grammar/poetry panel (`js/generator.js`), and a new curated-image panel (`js/gallery.js`). All files are plain `<script src>` includes with no bundler and no Jekyll front matter/Liquid — matching both Ziner's and slieve-gullion's existing patterns.

**Tech Stack:** Vanilla JS (ES2017, no modules, no build step), plain CSS, `html2canvas`/`jsPDF` via existing CDN `<script>` tags (already used by Ziner). Node.js (no framework) for pure-logic tests, following the `assert`/pass-fail-counter style already used in `phd/interdisciplinary-teaching/machine-learning-and-code/slieve-gullion/js/*.test.js`.

**Spec:** `docs/superpowers/specs/2026-08-27-zineworkshop-design.md`

## Global Constraints

- No Jekyll dependency anywhere in `/transfer/zineworkshop/`: no front matter, no Liquid, no `_includes`/`_layouts` references.
- No build step: every JS file is loaded via a plain `<script src="js/...">` tag in `index.html`, in dependency order.
- CDN `<script>` tags for `html2canvas` (`https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js`) and `jsPDF` (`https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js`) are carried over unchanged from `tools/ziner/index.html:915-916`.
- No participant image upload in the gallery panel for this exercise — gallery images come only from `data/gallery.json`.
- Grammar additions made via the in-app Word Bank are session-only; never written back to `data/grammar.json`.
- Pure-logic code gets Node tests in the slieve-gullion `assert`/counter style (run with `node <file>.test.js`, exit code 1 on any failure); DOM-only code (rendering, drag/resize, PDF export) is manual-verified in a browser — mirror the "Manual-verify items" comment block style from `slieve-gullion/js/reduction.test.js:8-16`.
- Ported Ziner code keeps its existing global `state` variable name unchanged (declared once, in `js/store.js`) so ported code needs no identifier renames.

---

### Task 1: Scaffold directory structure and HTML shell

**Files:**
- Create: `transfer/zineworkshop/index.html`
- Create: `transfer/zineworkshop/css/editor.css` (empty placeholder, filled in Task 2)
- Create: `transfer/zineworkshop/css/generator.css` (empty placeholder, filled in Task 8/9)
- Create: `transfer/zineworkshop/js/store.js` (empty placeholder, filled in Task 3)
- Create: `transfer/zineworkshop/js/tracery.js` (empty placeholder, filled in Task 4)
- Create: `transfer/zineworkshop/js/editor.js` (empty placeholder, filled in Task 6)
- Create: `transfer/zineworkshop/js/export.js` (empty placeholder, filled in Task 7)
- Create: `transfer/zineworkshop/js/generator.js` (empty placeholder, filled in Task 8)
- Create: `transfer/zineworkshop/js/gallery.js` (empty placeholder, filled in Task 9)
- Create: `transfer/zineworkshop/fonts/` (copy from `tools/ziner/fonts/`)

**Interfaces:**
- Produces: the `<script>` load order every later task assumes: `store.js` → `tracery.js` → `editor.js` → `export.js` → `generator.js` → `gallery.js`.

- [ ] **Step 1: Copy the fonts directory**

```bash
cp -r tools/ziner/fonts transfer/zineworkshop/fonts
```

- [ ] **Step 2: Create the empty CSS/JS placeholder files**

```bash
mkdir -p transfer/zineworkshop/css transfer/zineworkshop/js transfer/zineworkshop/data transfer/zineworkshop/images
touch transfer/zineworkshop/css/editor.css transfer/zineworkshop/css/generator.css
touch transfer/zineworkshop/js/store.js transfer/zineworkshop/js/tracery.js transfer/zineworkshop/js/editor.js
touch transfer/zineworkshop/js/export.js transfer/zineworkshop/js/generator.js transfer/zineworkshop/js/gallery.js
```

- [ ] **Step 3: Write `index.html` shell**

Write `transfer/zineworkshop/index.html` with this content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zine Workshop</title>
    <link rel="stylesheet" href="css/editor.css">
    <link rel="stylesheet" href="css/generator.css">
</head>
<body>
    <div class="zine-app">
        <!-- Task 10 fills in the toolbar, sidebar, canvas, generator panel, gallery panel, and properties/accessibility panels here -->
    </div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="js/store.js"></script>
    <script src="js/tracery.js"></script>
    <script src="js/editor.js"></script>
    <script src="js/export.js"></script>
    <script src="js/generator.js"></script>
    <script src="js/gallery.js"></script>
</body>
</html>
```

- [ ] **Step 4: Verify it loads with no console errors**

Open `transfer/zineworkshop/index.html` directly in a browser (`file://` is fine at this stage). Expected: blank page, no red errors in the console (404s for the two CDN scripts are fine offline — they only matter once PDF export is exercised in Task 11).

- [ ] **Step 5: Commit**

```bash
git add transfer/zineworkshop
git commit -m "Scaffold zineworkshop directory structure"
```

---

### Task 2: Port editor CSS

**Files:**
- Modify: `transfer/zineworkshop/css/editor.css`
- Reference: `tools/ziner/index.html:16-912` (the full contents of the `<style>` block, excluding the `<style>`/`</style>` tags themselves)

**Interfaces:**
- Produces: every CSS class/id referenced by the HTML markup Task 10 ports over (`.zine-app`, `.top-toolbar`, `.left-sidebar`, `.canvas-area`, `.canvas-container`, `.canvas-content`, `.right-panel`, `.properties-panel`, `.accessibility-panel`, `.preview-modal`, `.tool-btn`, `.gallery-item`, print media rules, etc.) — unchanged from Ziner.

- [ ] **Step 1: Copy the CSS block verbatim**

Copy lines 16-912 of `tools/ziner/index.html` into `transfer/zineworkshop/css/editor.css` exactly as they are (no `<style>`/`</style>` wrapper — this is a standalone `.css` file now).

- [ ] **Step 2: Verify the file has no leftover HTML tags**

```bash
grep -n "<style>\|</style>" transfer/zineworkshop/css/editor.css
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add transfer/zineworkshop/css/editor.css
git commit -m "Port Ziner editor CSS into zineworkshop"
```

---

### Task 3: `store.js` — shared state and pure helpers

**Files:**
- Create/modify: `transfer/zineworkshop/js/store.js`
- Test: `transfer/zineworkshop/js/store.test.js`
- Reference: `tools/ziner/index.html:1100-1117` (state object), `:1351-1415` (`generateId`, `randomRotation`, `getCurrentPage`, `getElementById`, `getAllElements`, `removeElementFromPage`)
- Reference: `phd/interdisciplinary-teaching/machine-learning-and-code/slieve-gullion/js/store.js` (`exportJSON`/`importFile` pattern)

**Interfaces:**
- Produces (globals, since this is a plain `<script>`, not a module):
  - `state` — the mutable app state object: `{ pages, currentPage, selectedId, editingId, pageFormat, fonts, dragState, resizeState, clipboard, guidesVisible, grammar, galleryImages, meta }`
  - `generateId()` → number
  - `randomRotation()` → number (-3..3)
  - `getCurrentPage()` → `{ id, elements }`
  - `getElementById(id)` → element object or `null`
  - `getAllElements()` → array of element objects
  - `removeElementFromPage(id)` → void (mutates `state`)
  - `exportProjectJSON()` → void (triggers a `.json` file download of `state`)
  - `importProjectJSON(file, onLoaded)` → void (reads `file`, replaces `state` in place, calls `onLoaded()`)
- Consumes: nothing (this is the base layer every other file depends on).

- [ ] **Step 1: Write `store.js`**

```js
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
    galleryImages: []          // replaced by data/gallery.json at startup
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
```

- [ ] **Step 2: Write the failing test for the pure helpers**

Write `transfer/zineworkshop/js/store.test.js`:

```js
/**
 * store.test.js — Node.js test for pure logic in store.js
 * Exercises: generateId, randomRotation, getCurrentPage, getElementById,
 *            getAllElements, removeElementFromPage
 * No DOM required.
 *
 * Manual-verify items (DOM/File API only, untestable in Node):
 *   - exportProjectJSON() — creates a Blob, triggers a download
 *   - importProjectJSON() — uses FileReader on a real File object
 */

'use strict';

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}

// ── Inline copies of store.js's pure functions (mirrors store.js exactly) ──

function generateId() {
    return Date.now() + Math.random();
}

function randomRotation() {
    return (Math.random() - 0.5) * 6;
}

function makeState() {
    return {
        pages: [{ id: 1, elements: [{ id: 'a' }, { id: 'b' }] }],
        currentPage: 0
    };
}

function getCurrentPage(state) {
    return state.pages[state.currentPage];
}

function getElementById(state, id) {
    const page = getCurrentPage(state);
    const element = page.elements?.find(el => el.id === id);
    if (element) return element;
    if (page.layers) {
        for (const layerType of ['background', 'content', 'overlay']) {
            if (page.layers[layerType]) {
                const el = page.layers[layerType].find(el => el.id === id);
                if (el) return el;
            }
        }
    }
    return null;
}

function getAllElements(state) {
    const page = getCurrentPage(state);
    const elements = [...(page.elements || [])];
    if (page.layers) {
        for (const layerType of ['background', 'content', 'overlay']) {
            if (page.layers[layerType]) elements.push(...page.layers[layerType]);
        }
    }
    return elements;
}

function removeElementFromPage(state, id) {
    const page = getCurrentPage(state);
    if (page.elements) page.elements = page.elements.filter(el => el.id !== id);
    if (page.layers) {
        for (const layerType of ['background', 'content', 'overlay']) {
            if (page.layers[layerType]) {
                page.layers[layerType] = page.layers[layerType].filter(el => el.id !== id);
            }
        }
    }
}

// ── Tests ────────────────────────────────────────────────────────────────

console.log('[generateId]');
const id1 = generateId();
const id2 = generateId();
assert('generateId returns a number', typeof id1 === 'number');
assert('two calls produce different ids', id1 !== id2);

console.log('\n[randomRotation]');
for (let i = 0; i < 20; i++) {
    const r = randomRotation();
    assert('rotation ' + r.toFixed(2) + ' is within [-3, 3]', r >= -3 && r <= 3);
}

console.log('\n[getCurrentPage / getElementById / getAllElements]');
const state = makeState();
assert('getCurrentPage returns page 0', getCurrentPage(state).id === 1);
assert('getElementById finds "a"', getElementById(state, 'a').id === 'a');
assert('getElementById returns null for missing id', getElementById(state, 'zzz') === null);
assert('getAllElements returns both elements', getAllElements(state).length === 2);

console.log('\n[removeElementFromPage]');
removeElementFromPage(state, 'a');
assert('after removal, 1 element remains', getAllElements(state).length === 1);
assert('remaining element is "b"', getAllElements(state)[0].id === 'b');

console.log('\n──────────────────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `node transfer/zineworkshop/js/store.test.js`
Expected: `Results: N passed, 0 failed` (this test is written against inline copies, so it should pass immediately — its purpose is to lock in the exact behavior `store.js` must match).

- [ ] **Step 4: Commit**

```bash
git add transfer/zineworkshop/js/store.js transfer/zineworkshop/js/store.test.js
git commit -m "Add zineworkshop store.js with shared state and pure helpers"
```

---

### Task 4: `tracery.js` — Tracery expansion engine

**Files:**
- Create: `transfer/zineworkshop/js/tracery.js`
- Test: `transfer/zineworkshop/js/tracery.test.js`
- Reference: `phd/interdisciplinary-teaching/machine-learning-and-code/slieve-gullion/js/tracery.js` (ported verbatim)

**Interfaces:**
- Produces: `window.Tracery.expand(grammar, symbol, depth)` → string
- Consumes: `state.grammar` (from `store.js`), read by `generator.js` in Task 8.

- [ ] **Step 1: Port `tracery.js` verbatim**

```js
window.Tracery = {
  expand: function (grammar, symbol, depth) {
    depth = depth || 0;
    if (depth > 20) return '[' + symbol + ']';
    var options = grammar[symbol];
    if (!options || !options.length) return '[' + symbol + ']';
    var template = options[Math.floor(Math.random() * options.length)];
    var self = this;
    return template.replace(/#([^#]+)#/g, function (_, s) {
      return self.expand(grammar, s, depth + 1);
    });
  }
};
```

- [ ] **Step 2: Write the failing test**

Write `transfer/zineworkshop/js/tracery.test.js`:

```js
/**
 * tracery.test.js — Node.js test for the Tracery expansion engine.
 * No DOM required.
 */

'use strict';

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}

var Tracery = {
  expand: function (grammar, symbol, depth) {
    depth = depth || 0;
    if (depth > 20) return '[' + symbol + ']';
    var options = grammar[symbol];
    if (!options || !options.length) return '[' + symbol + ']';
    var template = options[Math.floor(Math.random() * options.length)];
    var self = this;
    return template.replace(/#([^#]+)#/g, function (_, s) {
      return self.expand(grammar, s, depth + 1);
    });
  }
};

console.log('[single-option grammar is deterministic]');
var g1 = { origin: ['the #noun#'], noun: ['house'] };
assert('expands to "the house"', Tracery.expand(g1, 'origin') === 'the house');

console.log('\n[missing symbol falls back to bracketed name]');
var g2 = { origin: ['#missing#'] };
assert('unknown symbol renders as [missing]', Tracery.expand(g2, 'origin') === '[missing]');

console.log('\n[empty options array falls back to bracketed name]');
var g3 = { origin: [] };
assert('empty origin renders as [origin]', Tracery.expand(g3, 'origin') === '[origin]');

console.log('\n[nested symbols resolve recursively]');
var g4 = { origin: ['#a# #b#'], a: ['A'], b: ['B'] };
assert('expands both nested symbols', Tracery.expand(g4, 'origin') === 'A B');

console.log('\n[depth guard stops runaway recursion]');
var g5 = { origin: ['#origin#'] }; // self-referential — would recurse forever without the guard
var result = Tracery.expand(g5, 'origin');
assert('result contains a bracketed fallback rather than hanging', /\[origin\]/.test(result));

console.log('\n──────────────────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `node transfer/zineworkshop/js/tracery.test.js`
Expected: `Results: 5 passed, 0 failed`

- [ ] **Step 4: Commit**

```bash
git add transfer/zineworkshop/js/tracery.js transfer/zineworkshop/js/tracery.test.js
git commit -m "Port Tracery engine into zineworkshop"
```

---

### Task 5: Starter grammar and gallery data

**Files:**
- Create: `transfer/zineworkshop/data/grammar.json`
- Create: `transfer/zineworkshop/data/gallery.json`
- Create: `transfer/zineworkshop/images/placeholder-flyer.svg`

**Interfaces:**
- Produces: the on-disk shape `generator.js` (Task 8) and `gallery.js` (Task 9) load at startup — `grammar.json` matches `state.grammar`'s shape (`{ <symbol>: [string, ...] }`); `gallery.json` is an array of `{ id, src, alt, credit, caption }`.

- [ ] **Step 1: Write a small starter grammar**

This is placeholder content so the tool is buildable/testable before Glenn supplies the real workshop vocabulary (per the spec's "Dependencies on Glenn" section). Write `transfer/zineworkshop/data/grammar.json`:

```json
{
  "origin": [
    "the #noun_place# #verb_change#, and the #noun_people# #verb_stay#",
    "#adjective_state# #noun_place#: who gets to #verb_stay#?",
    "the #noun_people# #verb_stay# while the #noun_place# #verb_change#",
    "#noun_place#, #adjective_state#, still holding the #noun_people#"
  ],
  "noun_place": ["block", "corner store", "porch", "stoop", "lot", "rowhouse", "sidewalk"],
  "noun_people": ["neighbors", "tenants", "elders", "families", "the block association"],
  "verb_change": ["is rezoned", "goes up for sale", "is renovated", "changes hands"],
  "verb_stay": ["stay", "remember", "hold on", "keep the porch light on"],
  "adjective_state": ["familiar", "unrecognizable", "half-emptied", "still standing"]
}
```

- [ ] **Step 2: Write a small placeholder gallery**

Write `transfer/zineworkshop/data/gallery.json`:

```json
[
  {
    "id": "img_placeholder_001",
    "src": "images/placeholder-flyer.svg",
    "alt": "Placeholder flyer graphic — replace with a real, permission-cleared image before the workshop",
    "credit": "Placeholder — no real artist attached yet",
    "caption": ""
  }
]
```

- [ ] **Step 3: Create a placeholder SVG image**

Write `transfer/zineworkshop/images/placeholder-flyer.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400">
  <rect width="300" height="400" fill="#f0f0f0"/>
  <rect x="10" y="10" width="280" height="380" fill="none" stroke="#999" stroke-width="2" stroke-dasharray="8 6"/>
  <text x="150" y="190" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#666">Placeholder</text>
  <text x="150" y="215" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#999">flyer image</text>
</svg>
```

- [ ] **Step 4: Verify both JSON files parse**

```bash
node -e "JSON.parse(require('fs').readFileSync('transfer/zineworkshop/data/grammar.json')); console.log('grammar.json OK')"
node -e "JSON.parse(require('fs').readFileSync('transfer/zineworkshop/data/gallery.json')); console.log('gallery.json OK')"
```

Expected: both print `OK`.

- [ ] **Step 5: Commit**

```bash
git add transfer/zineworkshop/data transfer/zineworkshop/images
git commit -m "Add starter grammar and placeholder gallery data for zineworkshop"
```

---

### Task 6: `editor.js` — port the canvas editor

**Files:**
- Create/modify: `transfer/zineworkshop/js/editor.js`
- Reference: `tools/ziner/index.html` (line ranges below)

**Interfaces:**
- Consumes: `state`, `generateId`, `randomRotation`, `getCurrentPage`, `getElementById`, `getAllElements`, `removeElementFromPage` (all globals from `store.js`, Task 3).
- Produces (globals, consumed by `generator.js`/`gallery.js` in Tasks 8-9, and by `index.html`'s DOMContentLoaded init):
  - `render()`, `renderCanvas()` — re-render the current page
  - `createTextElement(x, y)`, `createImageElement(x, y, src, alt)`, `createTextureElement(x, y, src, alt, blendMode)`, `createBackgroundElement(color)`, `createBackgroundImageElement(src, alt)` — element factories
  - `addElement(element)` — pushes onto the current page, selects it, calls `render()`
  - `deleteElement(id)`, `updateElement(id, updates)`
  - `addPage()`, `removePage()`
  - `initializeEventListeners()` — wires all toolbar/canvas/property-panel event listeners (called once from `index.html`'s init)
  - `initializeFonts()` — async, loads the font system (called once from `index.html`'s init before `render()`)

This is a large, mostly mechanical port. Each step below copies one function group from `tools/ziner/index.html` into `editor.js` in the same order they appear in the source, so the whole file reads top-to-bottom exactly like the original once assembled.

- [ ] **Step 1: Port the provided-SVG images and font system**

Copy `tools/ziner/index.html:1057-1099` (the `providedImages` object) and `:1119-1349` (`fontSources`, `generateFontCSS`, `loadFont`, `measureFont`, `detectAvailableFonts`, `initializeFonts`, `generateOrganizedFontOptions`) into `editor.js`, in that order, verbatim.

- [ ] **Step 2: Port canvas format and guide rendering**

Copy `tools/ziner/index.html:1418-1528` (`updateCanvasFormat`, `renderPanelGuides`) into `editor.js`, appended after Step 1's code.

- [ ] **Step 3: Port render functions**

Copy `tools/ziner/index.html:1529-1737` (`render`, `renderCanvas`, `renderTextElement`, `renderImageElement`, `renderTextureElement`, `renderBackgroundElement`, `renderBackgroundImageElement`) into `editor.js`, appended after Step 2's code.

- [ ] **Step 4: Port element factories and CRUD**

Copy `tools/ziner/index.html:1738-1866` (`createTextElement` through `finishTextEdit`) into `editor.js`, appended after Step 3's code.

- [ ] **Step 5: Port font preview, credits, and image gallery/upload handlers**

Copy `tools/ziner/index.html:1867-2050` (`updateFontPreview`, `populateFontCredits`, `setupCreditsToggle`, `populateImageGallery`, `handleImageUpload`, `handleTextureUpload`, `handleBackgroundImageUpload`) into `editor.js`, appended after Step 4's code.

- [ ] **Step 6: Port event listener wiring, excluding `generatePDF`**

Copy `tools/ziner/index.html:2051-2385` (`initializeEventListeners`) into `editor.js`, appended after Step 5's code, with one change: delete the nested `async function generatePDF() { ... }` declaration at lines 2162-2288 (it moves to `export.js` in Task 7) and replace the print-btn listener at lines 2158-2160 with:

```js
document.getElementById('print-btn').addEventListener('click', async () => {
    await generatePDF();
});
```

(unchanged in content — `generatePDF` will now resolve to the top-level function `export.js` defines, since `editor.js` loads before `export.js` is needed at click-time, and both are globals by the time a user can click the button).

- [ ] **Step 7: Port page management**

Copy `tools/ziner/index.html:2386-2410` (`addPage`, `removePage`) into `editor.js`, appended after Step 6's code.

- [ ] **Step 8: Port drag/resize/touch handlers**

Copy `tools/ziner/index.html:2411-2773` (`handleMouseDown` through `handleTouchEnd`) into `editor.js`, appended after Step 7's code.

- [ ] **Step 9: Port properties panel**

Copy `tools/ziner/index.html:2774-3014` (`renderProperties`, `addPropertyEventListeners`) into `editor.js`, appended after Step 8's code.

- [ ] **Step 10: Port accessibility checks**

Copy `tools/ziner/index.html:3015-3378` (`renderAccessibility` through the end of the script, including `runAccessibilityChecks` and `calculateContrastRatio`) into `editor.js`, appended after Step 9's code.

- [ ] **Step 11: Add the init sequence**

Append to the end of `editor.js`:

```js
document.addEventListener('DOMContentLoaded', async function () {
    await initializeFonts();
    render();
    initializeEventListeners();
    Generator.init();   // added in Task 8
    Gallery.init();     // added in Task 9
});
```

(This replaces `tools/ziner/index.html:1958-1970`'s init block, extended to also start the new panels.)

- [ ] **Step 12: Verify no leftover references to `generatePDF`'s deleted local scope**

```bash
grep -n "async function generatePDF" transfer/zineworkshop/js/editor.js
```

Expected: no output (confirms Step 6 actually removed the nested declaration rather than leaving a duplicate).

- [ ] **Step 13: Manual smoke test in a browser**

Temporarily comment out the `Generator.init();` and `Gallery.init();` lines added in Step 11 (those files don't exist as working modules until Tasks 8-9), open `index.html`, and verify: the toolbar/sidebar/canvas render with correct styling, "Add Text" creates a draggable/editable text box, "Add Image" opens the provided-SVG gallery and placing one works, drag and resize work, the properties panel updates when an element is selected, and the accessibility panel shows checks. Then uncomment the two lines back (they'll no-op with a console error until Tasks 8-9 land, which is expected at this point).

- [ ] **Step 14: Commit**

```bash
git add transfer/zineworkshop/js/editor.js
git commit -m "Port Ziner canvas editor into zineworkshop editor.js"
```

---

### Task 7: `export.js` — PDF export and JSON save/load wiring

**Files:**
- Create/modify: `transfer/zineworkshop/js/export.js`
- Modify: `transfer/zineworkshop/index.html` (add Save/Load JSON buttons — done fully in Task 10, this task only requires the button ids exist by the time Task 10 runs; wire the listeners here referencing those future ids is fine since `addEventListener` calls no-op safely if the id doesn't exist yet... no — DOM lookups at load time will fail. Instead this task's listeners are wired inside `Export.init()`, called from `editor.js`'s DOMContentLoaded handler, by which point Task 10's HTML will already be in place.)
- Reference: `tools/ziner/index.html:2162-2288` (`generatePDF`, extracted verbatim)

**Interfaces:**
- Consumes: `state` (from `store.js`), `exportProjectJSON`/`importProjectJSON` (from `store.js`), `html2canvas`/`jsPDF` (CDN globals).
- Produces: top-level function `generatePDF()` (called by `editor.js`'s print-btn listener from Task 6); `Export.init()` (wires the Save JSON / Load JSON buttons Task 10 adds to the toolbar).

- [ ] **Step 1: Extract `generatePDF` verbatim**

Copy `tools/ziner/index.html:2162-2288` into `export.js` as a top-level (non-nested) function declaration, unchanged.

- [ ] **Step 2: Add `Export.init()` for JSON save/load wiring**

Append to `export.js`:

```js
const Export = {
    init: function () {
        const saveBtn = document.getElementById('save-json-btn');
        const loadBtn = document.getElementById('load-json-btn');
        const loadInput = document.getElementById('load-json-input');

        if (saveBtn) {
            saveBtn.addEventListener('click', () => exportProjectJSON());
        }
        if (loadBtn && loadInput) {
            loadBtn.addEventListener('click', () => loadInput.click());
            loadInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                loadInput.value = '';
                if (!file) return;
                importProjectJSON(file, () => {
                    updateCanvasFormat();
                    render();
                });
            });
        }
    }
};
```

- [ ] **Step 3: Call `Export.init()` from the init sequence**

In `editor.js`, extend the `DOMContentLoaded` block added in Task 6 Step 11 to also call `Export.init();` (alongside `Generator.init();` and `Gallery.init();`).

- [ ] **Step 4: Manual verification (deferred to Task 11)**

PDF export and JSON save/load both require the buttons Task 10 adds and a live browser (CDN scripts, File API) — verified together with the rest of the UI in Task 11's manual pass.

- [ ] **Step 5: Commit**

```bash
git add transfer/zineworkshop/js/export.js transfer/zineworkshop/js/editor.js
git commit -m "Add zineworkshop PDF export and JSON save/load wiring"
```

---

### Task 8: `generator.js` — poetry generator panel

**Files:**
- Create: `transfer/zineworkshop/js/generator.js`
- Test: `transfer/zineworkshop/js/generator.test.js`
- Modify: `transfer/zineworkshop/css/generator.css`

**Interfaces:**
- Consumes: `state.grammar` (from `store.js`), `Tracery.expand` (from `tracery.js`), `createTextElement`/`addElement`/`render` (from `editor.js`).
- Produces: `Generator.init()` — loads `data/grammar.json` into `state.grammar` and wires the panel's controls; `addWordToGrammar(grammar, symbol, word)` — pure function, exported for the test.

- [ ] **Step 1: Write the pure grammar-mutation helper and generation/insert logic**

```js
// generator.js — poetry generator panel: pick a symbol, generate a Tracery
// line, insert it as a text element or reroll; edit the grammar's word bank.

function addWordToGrammar(grammar, symbol, word) {
    const trimmed = word.trim();
    if (!trimmed) return grammar;
    if (!grammar[symbol]) grammar[symbol] = [];
    if (!grammar[symbol].includes(trimmed)) {
        grammar[symbol].push(trimmed);
    }
    return grammar;
}

const Generator = {
    _lastLine: '',
    _lastSymbol: 'origin',

    init: function () {
        fetch('data/grammar.json')
            .then(r => r.json())
            .then(data => {
                state.grammar = data;
                this.renderSymbolOptions();
                this.renderWordBank();
            })
            .catch(() => {
                // Keep store.js's default { origin: [] } grammar so the panel still renders.
                this.renderSymbolOptions();
                this.renderWordBank();
            });

        document.getElementById('generate-btn').addEventListener('click', () => this.generate());
        document.getElementById('insert-line-btn').addEventListener('click', () => this.insert());
        document.getElementById('word-bank-add-btn').addEventListener('click', () => this.addWord());
    },

    renderSymbolOptions: function () {
        const select = document.getElementById('generator-symbol-select');
        select.innerHTML = '';
        Object.keys(state.grammar).forEach(symbol => {
            const opt = document.createElement('option');
            opt.value = symbol;
            opt.textContent = symbol;
            select.appendChild(opt);
        });
        select.value = 'origin' in state.grammar ? 'origin' : Object.keys(state.grammar)[0] || '';
    },

    generate: function () {
        const symbol = document.getElementById('generator-symbol-select').value;
        if (!symbol) return;
        this._lastSymbol = symbol;
        this._lastLine = Tracery.expand(state.grammar, symbol);
        document.getElementById('generator-output').textContent = this._lastLine;
        document.getElementById('insert-line-btn').disabled = false;
    },

    insert: function () {
        if (!this._lastLine) return;
        const element = createTextElement(120, 120);
        element.content = this._lastLine;
        addElement(element);
    },

    addWord: function () {
        const symbol = document.getElementById('word-bank-symbol-select').value;
        const input = document.getElementById('word-bank-input');
        if (!symbol || !input.value.trim()) return;
        addWordToGrammar(state.grammar, symbol, input.value);
        input.value = '';
        this.renderWordBank();
    },

    renderWordBank: function () {
        const select = document.getElementById('word-bank-symbol-select');
        const list = document.getElementById('word-bank-list');
        const currentSelectValue = select.value;

        select.innerHTML = '';
        Object.keys(state.grammar).forEach(symbol => {
            const opt = document.createElement('option');
            opt.value = symbol;
            opt.textContent = symbol;
            select.appendChild(opt);
        });
        if (currentSelectValue && state.grammar[currentSelectValue]) {
            select.value = currentSelectValue;
        }

        const activeSymbol = select.value;
        list.innerHTML = '';
        (state.grammar[activeSymbol] || []).forEach(entry => {
            const li = document.createElement('li');
            li.textContent = entry;
            list.appendChild(li);
        });
    }
};
```

- [ ] **Step 2: Write the failing test for `addWordToGrammar`**

Write `transfer/zineworkshop/js/generator.test.js`:

```js
/**
 * generator.test.js — Node.js test for the pure grammar-mutation logic in generator.js.
 * No DOM required.
 *
 * Manual-verify items (DOM/fetch only, untestable in Node):
 *   - Generator.init()             — fetches data/grammar.json, wires buttons
 *   - Generator.generate()/insert() — reads/writes the DOM, calls createTextElement/addElement
 *   - Generator.renderSymbolOptions()/renderWordBank() — builds <option>/<li> DOM nodes
 */

'use strict';

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}

function addWordToGrammar(grammar, symbol, word) {
    const trimmed = word.trim();
    if (!trimmed) return grammar;
    if (!grammar[symbol]) grammar[symbol] = [];
    if (!grammar[symbol].includes(trimmed)) {
        grammar[symbol].push(trimmed);
    }
    return grammar;
}

console.log('[adding a word to an existing symbol]');
let g1 = { noun_place: ['block'] };
addWordToGrammar(g1, 'noun_place', 'alley');
assert('symbol now has 2 entries', g1.noun_place.length === 2);
assert('new entry is present', g1.noun_place.includes('alley'));

console.log('\n[adding a word to a new symbol creates it]');
let g2 = {};
addWordToGrammar(g2, 'new_symbol', 'hello');
assert('new symbol array was created', Array.isArray(g2.new_symbol));
assert('new symbol has the word', g2.new_symbol[0] === 'hello');

console.log('\n[whitespace is trimmed]');
let g3 = { noun_place: [] };
addWordToGrammar(g3, 'noun_place', '  porch  ');
assert('stored value is trimmed', g3.noun_place[0] === 'porch');

console.log('\n[blank input is a no-op]');
let g4 = { noun_place: ['block'] };
addWordToGrammar(g4, 'noun_place', '   ');
assert('array length unchanged', g4.noun_place.length === 1);

console.log('\n[duplicate word is not added twice]');
let g5 = { noun_place: ['block'] };
addWordToGrammar(g5, 'noun_place', 'block');
assert('array length unchanged', g5.noun_place.length === 1);

console.log('\n──────────────────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `node transfer/zineworkshop/js/generator.test.js`
Expected: `Results: 5 passed, 0 failed`

- [ ] **Step 4: Add the generator panel CSS**

Append to `transfer/zineworkshop/css/generator.css`:

```css
.generator-panel {
    padding: 12px;
    border-top: 1px solid rgba(122, 6, 97, 0.2);
}

.generator-panel h3 {
    margin: 0 0 8px 0;
    font-size: 13px;
    color: rgb(122, 6, 97);
}

.generator-output {
    min-height: 40px;
    padding: 8px;
    margin: 8px 0;
    background: #f9f9f9;
    border: 1px solid rgba(122, 6, 97, 0.15);
    border-radius: 4px;
    font-size: 13px;
    font-style: italic;
}

.word-bank-list {
    list-style: none;
    margin: 8px 0 0 0;
    padding: 0;
    max-height: 120px;
    overflow-y: auto;
    font-size: 11px;
}

.word-bank-list li {
    padding: 3px 6px;
    border-bottom: 1px solid #eee;
}
```

- [ ] **Step 5: Commit**

```bash
git add transfer/zineworkshop/js/generator.js transfer/zineworkshop/js/generator.test.js transfer/zineworkshop/css/generator.css
git commit -m "Add zineworkshop poetry generator panel"
```

---

### Task 9: `gallery.js` — curated image gallery panel

**Files:**
- Create: `transfer/zineworkshop/js/gallery.js`
- Test: `transfer/zineworkshop/js/gallery.test.js`
- Modify: `transfer/zineworkshop/css/generator.css`

**Interfaces:**
- Consumes: `createImageElement`/`addElement` (from `editor.js`).
- Produces: `Gallery.init()` — loads `data/gallery.json` into `state.galleryImages` and renders the panel; `formatCredit(image)` — pure function, exported for the test.

- [ ] **Step 1: Write the pure credit-formatting helper and panel logic**

```js
// gallery.js — curated, permission-cleared image gallery panel.
// No participant upload in this panel; images come only from data/gallery.json.

function formatCredit(image) {
    if (!image.credit) return '';
    return image.caption ? image.credit + ' — ' + image.caption : image.credit;
}

const Gallery = {
    init: function () {
        fetch('data/gallery.json')
            .then(r => r.json())
            .then(data => {
                state.galleryImages = data;
                this.render();
            })
            .catch(() => {
                state.galleryImages = [];
                this.render();
            });
    },

    render: function () {
        const container = document.getElementById('curated-gallery');
        container.innerHTML = '';
        state.galleryImages.forEach(image => {
            const item = document.createElement('div');
            item.className = 'gallery-item curated-gallery-item';
            item.title = formatCredit(image) || image.alt;

            const img = document.createElement('img');
            img.src = image.src;
            img.alt = image.alt;
            img.style.width = '48px';
            img.style.height = '64px';
            img.style.objectFit = 'cover';
            item.appendChild(img);

            const credit = document.createElement('span');
            credit.className = 'curated-gallery-credit';
            credit.textContent = formatCredit(image);
            item.appendChild(credit);

            item.addEventListener('click', () => {
                const element = createImageElement(100, 100, image.src, image.alt);
                addElement(element);
            });

            container.appendChild(item);
        });
    }
};
```

- [ ] **Step 2: Write the failing test for `formatCredit`**

Write `transfer/zineworkshop/js/gallery.test.js`:

```js
/**
 * gallery.test.js — Node.js test for the pure credit-formatting logic in gallery.js.
 * No DOM required.
 *
 * Manual-verify items (DOM/fetch only, untestable in Node):
 *   - Gallery.init()  — fetches data/gallery.json
 *   - Gallery.render() — builds .curated-gallery-item DOM nodes, wires click-to-place
 */

'use strict';

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}

function formatCredit(image) {
    if (!image.credit) return '';
    return image.caption ? image.credit + ' — ' + image.caption : image.credit;
}

console.log('[credit with no caption]');
assert(
    'returns just the credit',
    formatCredit({ credit: 'Jane Doe', caption: '' }) === 'Jane Doe'
);

console.log('\n[credit with a caption]');
assert(
    'joins credit and caption with an em dash',
    formatCredit({ credit: 'Jane Doe', caption: 'flyer, 2024' }) === 'Jane Doe — flyer, 2024'
);

console.log('\n[no credit at all]');
assert(
    'returns an empty string',
    formatCredit({ credit: '', caption: 'flyer, 2024' }) === ''
);

console.log('\n──────────────────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `node transfer/zineworkshop/js/gallery.test.js`
Expected: `Results: 3 passed, 0 failed`

- [ ] **Step 4: Add the curated gallery CSS**

Append to `transfer/zineworkshop/css/generator.css`:

```css
.curated-gallery-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 56px;
    margin: 4px;
    cursor: pointer;
}

.curated-gallery-credit {
    font-size: 8px;
    color: #666;
    text-align: center;
    line-height: 1.2;
    margin-top: 2px;
}
```

- [ ] **Step 5: Commit**

```bash
git add transfer/zineworkshop/js/gallery.js transfer/zineworkshop/js/gallery.test.js transfer/zineworkshop/css/generator.css
git commit -m "Add zineworkshop curated image gallery panel"
```

---

### Task 10: Wire the full HTML body

**Files:**
- Modify: `transfer/zineworkshop/index.html`
- Reference: `tools/ziner/index.html:918-1055` (the body Task 6's `editor.js` expects to find in the DOM)

**Interfaces:**
- Produces: every element id `editor.js`, `export.js`, `generator.js`, and `gallery.js` look up via `document.getElementById`.

- [ ] **Step 1: Port Ziner's body markup**

Copy `tools/ziner/index.html:918-1055` into the `<div class="zine-app">` placeholder in `transfer/zineworkshop/index.html` (from Task 1 Step 3), verbatim, with two additions:

In the top toolbar's `.export-buttons` div (originally `tools/ziner/index.html:931-935`), add two buttons plus a hidden file input, so it reads:

```html
<div class="export-buttons">
    <button class="btn" id="print-btn">Save as PDF</button>
    <button class="btn btn-secondary" id="preview-btn">Digital Preview</button>
    <button class="btn btn-tertiary" id="toggle-guides-btn" title="Show/hide guides">Hide Guides</button>
    <button class="btn btn-secondary" id="save-json-btn">Save Project</button>
    <button class="btn btn-secondary" id="load-json-btn">Load Project</button>
    <input type="file" id="load-json-input" accept="application/json" style="display: none;">
</div>
```

- [ ] **Step 2: Add the generator panel**

Inside `.left-sidebar`, after the "Images" `.tool-section` (originally ending at `tools/ziner/index.html:995`) and before the "Font Credits" section, insert:

```html
<div class="tool-section generator-panel">
    <h3>Poetry Generator</h3>
    <select id="generator-symbol-select"></select>
    <button class="tool-btn" id="generate-btn">Generate</button>
    <div class="generator-output" id="generator-output"></div>
    <button class="tool-btn" id="insert-line-btn" disabled>Insert as text</button>

    <h3 style="margin-top: 12px;">Word Bank</h3>
    <select id="word-bank-symbol-select"></select>
    <input type="text" id="word-bank-input" placeholder="Add a word or line…">
    <button class="tool-btn" id="word-bank-add-btn">Add</button>
    <ul class="word-bank-list" id="word-bank-list"></ul>
</div>
```

- [ ] **Step 3: Add the curated gallery panel**

Immediately after the panel added in Step 2, insert:

```html
<div class="tool-section">
    <h3>Flyers &amp; Images</h3>
    <div class="image-gallery" id="curated-gallery"></div>
</div>
```

- [ ] **Step 4: Verify all referenced ids exist**

```bash
for id in print-btn preview-btn toggle-guides-btn save-json-btn load-json-btn load-json-input \
          generator-symbol-select generate-btn generator-output insert-line-btn \
          word-bank-symbol-select word-bank-input word-bank-add-btn word-bank-list \
          curated-gallery add-text-btn add-image-btn delete-btn image-gallery \
          canvas-content properties-panel accessibility-summary accessibility-checks \
          preview-modal add-page-btn remove-page-btn page-tabs; do
  grep -q "id=\"$id\"" transfer/zineworkshop/index.html || echo "MISSING: $id"
done
```

Expected: no output (every id `editor.js`/`export.js`/`generator.js`/`gallery.js` look up is present).

- [ ] **Step 5: Commit**

```bash
git add transfer/zineworkshop/index.html
git commit -m "Wire full zineworkshop HTML body with generator and gallery panels"
```

---

### Task 11: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Free-typed-only zine**

Open `transfer/zineworkshop/index.html` in a browser via a local static server (not `file://`, so `fetch('data/grammar.json')` and `fetch('data/gallery.json')` succeed — e.g. `python3 -m http.server` from `transfer/zineworkshop/`). Add a text element, double-click to type your own content, style it, add a background. Confirm the Poetry Generator and Flyers panels are visible but untouched content still displays correctly.

- [ ] **Step 2: Generated-text zine**

In the Poetry Generator panel, select `origin`, click Generate, click Insert as text — confirm a new draggable/editable text element appears with the generated line. Add a word to the `noun_place` word bank, regenerate a few times, confirm the new word eventually appears in generated output.

- [ ] **Step 3: Mixed zine with a gallery image**

Click the placeholder flyer in the Flyers &amp; Images panel — confirm it's placed on canvas as a draggable/resizable image element with correct alt text. Combine with a generated text element and a free-typed one on the same page.

- [ ] **Step 4: Export/import round trip**

Click "Save Project" — confirm a `zine-project.json` file downloads. Reload the page, click "Load Project", select the downloaded file — confirm the page's elements (all three from Steps 1-3) reappear identically.

- [ ] **Step 5: PDF export**

With the mixed zine from Step 3 on screen, click "Save as PDF" — confirm a PDF downloads and visually matches the canvas (guides hidden, no selection outline).

- [ ] **Step 6: Accessibility panel sanity check**

Confirm the accessibility panel updates as elements are added/moved (e.g. flags a text element dragged outside the margin guides, or low-contrast text color).

- [ ] **Step 7: Record results**

If any step fails, fix the underlying task's code before proceeding — do not commit a passing "verification" over a failing tool. Once all six steps pass, note that fact in the PR/commit message for this task (no separate file needed).

---

### Task 12: README and final commit

**Files:**
- Create: `transfer/zineworkshop/README.md`

- [ ] **Step 1: Write the README**

```markdown
# Zine Workshop

A standalone, Jekyll-free zine-making tool for an anti-gentrification
workshop, forked from `tools/ziner/`. Adds two optional panels alongside the
existing drag-and-drop canvas:

- **Poetry Generator** — a Tracery-style grammar (`data/grammar.json`)
  participants can generate lines from, insert as editable text elements, or
  ignore entirely in favor of typing their own text (already supported by
  every text element). Participants can also add their own words to the
  grammar's Word Bank during the session — those additions are not saved
  back to `data/grammar.json`.
- **Flyers & Images** — a curated, permission-cleared gallery
  (`data/gallery.json`) participants can place on the canvas. No participant
  upload in this exercise.

## Before the workshop

Replace the placeholder content with the real thing:

1. **`data/grammar.json`** — the actual anti-gentrification vocabulary and
   templates (see the existing file for the required shape: an `origin`
   array of template strings plus one array per `#symbol#` they reference).
2. **`data/gallery.json`** + **`images/`** — the real, permission-cleared
   flyer/photo set, each entry with correct `credit` attribution. Remove
   `images/placeholder-flyer.svg` and its `data/gallery.json` entry once
   real images are in place.

## Running locally

No build step. Serve the folder with any static file server (needed for the
`fetch()` calls that load the JSON data files — opening `index.html`
directly via `file://` will not load the grammar or gallery):

```bash
cd transfer/zineworkshop
python3 -m http.server
```

Then open `http://localhost:8000/`.

## File layout

See `docs/superpowers/specs/2026-08-27-zineworkshop-design.md` for the full
design rationale. Summary:

- `js/store.js` — shared state + save/load
- `js/tracery.js` — grammar expansion engine
- `js/editor.js` — canvas (ported from `tools/ziner/`)
- `js/export.js` — PDF export + JSON save/load wiring
- `js/generator.js` — poetry generator panel
- `js/gallery.js` — curated image panel
```

- [ ] **Step 2: Commit**

```bash
git add transfer/zineworkshop/README.md
git commit -m "Add zineworkshop README"
```
