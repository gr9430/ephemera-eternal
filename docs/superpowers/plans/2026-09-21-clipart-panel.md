# Clip Art Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Clip Art" panel of pre-cut transparent collage pieces that participants click to place on the zine canvas.

**Architecture:** A new `js/clipart.js` (modeled on `js/gallery.js`) fetches `data/clipart.json`, renders a flat checkerboard thumbnail grid, and on click places the piece through the existing `createImageElement` / `addElement`. Pure helpers (`fitWithin`, `clipartTitle`, `validateClipart`) are exported for Node tests via a `module.exports` guard, so tests run the shipped code rather than a pasted copy.

**Tech Stack:** Plain static HTML/CSS/JS, no build step. Tests are plain Node scripts (`node js/<name>.test.js`), Node 20.

**Spec:** `docs/superpowers/specs/2026-09-21-clipart-panel-design.md` (extends `2026-08-27-zineworkshop-design.md`)

## Global Constraints

- No Jekyll, no build step, no bundler; plain `<script src>` tags only.
- **Do not run `git commit`, `git add`, or any command that changes git state.** Glenn has said not to commit yet. This plan deliberately has no commit steps.
- No participant upload control in the new panel.
- Required `clipart.json` fields: `id`, `src`, `alt`, `credit`, `provenance`. Optional: `source`, `tags` (stored, unused in v1).
- Panel is a flat grid: no grouping, no filters.
- Placed pieces are ordinary `type: 'image'` elements; JSON save/load must not change.
- Do not touch the leftover file-upload code in `js/editor.js` (~line 858); it is a separate open decision.

## File Structure

| File | Responsibility |
|---|---|
| `js/clipart.js` (create) | Pure helpers + `Clipart` panel object (init/render/place) |
| `js/clipart.test.js` (create) | Node tests for helpers and for `data/clipart.json` validity |
| `data/clipart.json` (create) | Piece list, seeded with `lamp.png` |
| `js/store.js` (modify) | Add `clipartImages: []` to `state` |
| `index.html` (modify) | New "Clip Art" panel + `<script src="js/clipart.js">` |
| `css/generator.css` (modify) | Checkerboard grid/thumbnail styles |
| `js/editor.js` (modify, 1 line) | Call `Clipart.init()` at startup |
| `README.md`, `docs/superpowers/specs/2026-08-27-zineworkshop-design.md` (modify) | Docs |

## Prerequisite: facts only Glenn has

`images/clipart/lamp.png` already exists. Its `credit`, `provenance`, and `source` values are not recorded anywhere. **Before Task 1 Step 5, ask Glenn** for:
1. `credit` — who made it (artist name as it should display).
2. `provenance` — e.g. `own work` or `co-presenter, permission granted`.
3. `source` — which flyer/origin it was cut from (may be empty).

Do not invent these. Use his answers verbatim.

---

### Task 1: Helpers, data, and tests

**Files:**
- Create: `js/clipart.js`
- Create: `js/clipart.test.js`
- Create: `data/clipart.json`
- Modify: `js/store.js:20-21`

**Interfaces:**
- Produces (from `js/clipart.js`, also `module.exports` for Node):
  - `fitWithin(w: number, h: number, max: number) -> { w: number, h: number }` — scales down to fit a `max` x `max` box preserving aspect ratio, never upscales, rounds to integers; if `w` or `h` is falsy returns `{ w: max, h: max }`.
  - `clipartTitle(piece) -> string` — `credit` (falling back to `alt`), plus ` — cut from <source>` when `source` is non-empty.
  - `validateClipart(list) -> string[]` — array of human-readable error strings; empty means valid.
  - `CLIPART_START_MAX` = `200` (starting bounding box in canvas px).

- [ ] **Step 1: Baseline — confirm existing tests pass**

Run: `cd /home/user/repos/ephemera-eternal && for f in js/*.test.js; do node "$f" >/dev/null || echo "FAIL $f"; done; echo done`
Expected: prints only `done` (no `FAIL` lines). If any FAIL appears, stop and report it; it is pre-existing.

- [ ] **Step 2: Write the failing test**

Create `js/clipart.test.js`:

```js
/**
 * clipart.test.js — Node.js tests for the pure logic in clipart.js and for the
 * shape of data/clipart.json. No DOM required.
 *
 * Manual-verify items (DOM/fetch only, untestable in Node):
 *   - Clipart.init()   — fetches data/clipart.json
 *   - Clipart.render() — builds .clipart-item DOM nodes, wires click-to-place
 *   - Clipart.place()  — loads the image to read its size, then adds an element
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { fitWithin, clipartTitle, validateClipart, CLIPART_START_MAX } = require('./clipart.js');

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

const valid = {
    id: 'a', src: 'images/clipart/a.png', alt: 'a thing',
    credit: 'Someone', provenance: 'own work'
};

console.log('[fitWithin]');
assert('scales a tall image to fit the box, keeping aspect ratio',
    eq(fitWithin(848, 1080, 200), { w: 157, h: 200 }));
assert('scales a wide image to fit the box',
    eq(fitWithin(1000, 500, 200), { w: 200, h: 100 }));
assert('never upscales a small image',
    eq(fitWithin(40, 30, 200), { w: 40, h: 30 }));
assert('falls back to a square box when a dimension is missing',
    eq(fitWithin(0, 0, 200), { w: 200, h: 200 }));
assert('CLIPART_START_MAX is 200', CLIPART_START_MAX === 200);

console.log('\n[clipartTitle]');
assert('credit alone when there is no source',
    clipartTitle({ credit: 'Jane', alt: 'x' }) === 'Jane');
assert('appends the source flyer when present',
    clipartTitle({ credit: 'Jane', alt: 'x', source: 'Show flyer 2018' }) === 'Jane — cut from Show flyer 2018');
assert('falls back to alt when credit is empty',
    clipartTitle({ credit: '', alt: 'a lamp' }) === 'a lamp');

console.log('\n[validateClipart]');
assert('a complete entry has no errors', validateClipart([valid]).length === 0);
assert('optional source and tags are allowed',
    validateClipart([Object.assign({}, valid, { source: 's', tags: ['lamp'] })]).length === 0);
assert('a missing required field is reported',
    validateClipart([Object.assign({}, valid, { alt: undefined })]).some(e => e.includes('alt')));
assert('a whitespace-only required field is reported',
    validateClipart([Object.assign({}, valid, { provenance: '   ' })]).some(e => e.includes('provenance')));
assert('duplicate ids are reported',
    validateClipart([valid, Object.assign({}, valid, { src: 'images/clipart/b.png' })]).some(e => e.includes('duplicate')));
assert('non-array tags are reported',
    validateClipart([Object.assign({}, valid, { tags: 'lamp' })]).some(e => e.includes('tags')));
assert('a non-array list is reported', validateClipart({}).length > 0);

console.log('\n[data/clipart.json]');
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'clipart.json'), 'utf8'));
const errors = validateClipart(data);
assert('every entry passes validateClipart' + (errors.length ? ' — ' + errors.join('; ') : ''),
    errors.length === 0);
data.forEach(piece => {
    assert('image file exists for ' + piece.id, fs.existsSync(path.join(root, piece.src)));
});

console.log('\n──────────────────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /home/user/repos/ephemera-eternal && node js/clipart.test.js`
Expected: FAIL with `Cannot find module './clipart.js'`

- [ ] **Step 4: Write the helpers**

Create `js/clipart.js` with the helpers only (the panel object comes in Task 2):

```js
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { fitWithin, clipartTitle, validateClipart, CLIPART_START_MAX };
}
```

- [ ] **Step 5: Create the data file** (after the Prerequisite answers)

Create `data/clipart.json`, substituting Glenn's answers for the three `<...>` values (omit the `source` line entirely if he has none):

```json
[
  {
    "id": "clip_lamp_001",
    "src": "images/clipart/lamp.png",
    "alt": "Black ink wall-mounted street lantern with curled iron bracket",
    "source": "<source flyer or origin>",
    "credit": "<credit>",
    "provenance": "<provenance>",
    "tags": []
  }
]
```

- [ ] **Step 6: Add the store field**

In `js/store.js`, change the last two state lines:

```js
    galleryImages: []          // replaced by data/gallery.json at startup
};
```
to
```js
    galleryImages: [],         // replaced by data/gallery.json at startup
    clipartImages: []          // replaced by data/clipart.json at startup
};
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd /home/user/repos/ephemera-eternal && node js/clipart.test.js && node js/store.test.js`
Expected: `Results: 17 passed, 0 failed` for clipart (15 fixed assertions + 1 validity check + 1 file-exists check per data entry = 17 with one entry) and store tests still passing. If the count differs only because more entries were added, that is fine; `0 failed` is what matters.

---

### Task 2: Panel UI

**Files:**
- Modify: `js/clipart.js` (append the `Clipart` object, above the `module.exports` guard)
- Modify: `index.html` (panel after the "Flyers & Images" section, ~line 108-110; script tag ~line 177)
- Modify: `css/generator.css` (append)
- Modify: `js/editor.js:2119` (add init call)

**Interfaces:**
- Consumes: `fitWithin`, `clipartTitle`, `CLIPART_START_MAX` (Task 1); globals `state.clipartImages`, `createImageElement(x, y, src, alt)`, `addElement(element)` from `store.js`/`editor.js`.
- Produces: `Clipart.init()`, `Clipart.render()`, `Clipart.place(piece)`.

- [ ] **Step 1: Append the panel object to `js/clipart.js`**

Insert immediately above the `if (typeof module !== 'undefined' ...` block:

```js
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
```

- [ ] **Step 2: Add the panel markup**

In `index.html`, directly after the closing `</div>` of the `Flyers &amp; Images` tool-section, add:

```html
            <div class="tool-section">
                <h3>Clip Art</h3>
                <div class="clipart-grid" id="clipart-gallery"></div>
            </div>
```

And add the script tag after the gallery one:

```html
    <script src="js/gallery.js"></script>
    <script src="js/clipart.js"></script>
```

- [ ] **Step 3: Add the styles**

Append to `css/generator.css`:

```css
.clipart-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin-top: 10px;
}

.clipart-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
}

.clipart-thumb {
    width: 100%;
    aspect-ratio: 1;
    object-fit: contain;
    border: 1px solid rgba(122, 6, 97, 0.3);
    background-color: #fff;
    background-image:
        linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%),
        linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%);
    background-size: 12px 12px;
    background-position: 0 0, 6px 6px;
}

.clipart-item:hover .clipart-thumb {
    border-color: rgb(122, 6, 97);
}
```

- [ ] **Step 4: Wire startup**

In `js/editor.js`, in the `DOMContentLoaded` block, after `Gallery.init();     // added in Task 9` add:

```js
    Clipart.init();
```

- [ ] **Step 5: Verify tests still pass**

Run: `cd /home/user/repos/ephemera-eternal && for f in js/*.test.js; do node "$f" >/dev/null && echo "ok $f" || echo "FAIL $f"; done`
Expected: `ok` for all five test files.

- [ ] **Step 6: Manual browser verification**

Run: `cd /home/user/repos/ephemera-eternal && python3 -m http.server 8000` and open `http://localhost:8000/`. Confirm each:
1. A "Clip Art" panel appears under "Flyers & Images" with one thumbnail (the lamp) on a checkerboard, credit text beneath it, and a hover tooltip showing credit and "— cut from …".
2. Clicking it places the lamp on the canvas at about 157 x 200, un-stretched, with the checkerboard NOT showing on the canvas (transparent background).
3. The placed lamp can be dragged, resized, rotated, and deleted; the Properties panel opens; the accessibility panel shows "Image has accessibility description".
4. Save project JSON, reload the page, load the JSON: the lamp is restored.
5. Export to PDF / print preview includes the lamp.
6. The browser console shows no errors.

Report each of the six as pass/fail. Do not claim success on any item that was not actually observed.

---

### Task 3: Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-08-27-zineworkshop-design.md`

- [ ] **Step 1: README — describe the panel and how to add pieces**

In `README.md`, add a third bullet to the panel list near the top:

```markdown
- **Clip Art** — pre-cut, transparent-background collage pieces
  (`data/clipart.json`) participants can place on the canvas as building
  material. Prepared ahead of time; no in-app cutting and no upload.
```

and add a new section after "Before the workshop":

```markdown
## Adding clip art

1. Export the piece as a transparent-background PNG into `images/clipart/`.
2. Add an entry to `data/clipart.json`:

   ```json
   { "id": "clip_lamp_001", "src": "images/clipart/lamp.png",
     "alt": "what the piece shows, for screen readers",
     "source": "flyer it was cut from (optional)",
     "credit": "artist / photographer",
     "provenance": "own work | co-presenter, permission granted",
     "tags": [] }
   ```

   `id`, `src`, `alt`, `credit`, and `provenance` are required. Subjects are
   non-human by Glenn's choice, and every piece needs permission cleared.
3. Run `node js/clipart.test.js` — it checks every entry has the required
   fields, unique ids, and an image file that exists.
```

Also delete the stale `cd transfer/zineworkshop` reference if any remains (`grep -n transfer README.md` should print nothing).

- [ ] **Step 2: Original spec — fix the stale location**

In `docs/superpowers/specs/2026-08-27-zineworkshop-design.md`, replace

```
Lives at `/transfer/zineworkshop/` in this repo — a staging area for content
bound for Glenn's new Codeberg/Forgejo-hosted portfolio, which has no Jekyll.
```
with
```
Originally staged at `/transfer/zineworkshop/` in the portfolio repo; now lives
at the root of the `ephemera-eternal` repo (paths below are relative to that
root). It is destined for Glenn's Codeberg/Forgejo-hosted portfolio, which has
no Jekyll.
```
and in the File layout code block replace the first line `/transfer/zineworkshop/` with `(repo root)`.

- [ ] **Step 3: Verify**

Run: `cd /home/user/repos/ephemera-eternal && grep -rn "transfer/zineworkshop" README.md docs/superpowers/specs/2026-08-27-zineworkshop-design.md`
Expected: only the one intentional "Originally staged at" mention in the spec; none in the README.

Then run `git status --short` and confirm nothing was committed or staged by any step.
