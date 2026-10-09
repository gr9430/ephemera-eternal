# Word Consent, Organizer Review and Addendum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Word Bank with a consent-based "Add a word or line…" box whose consented words wait for Glenn's passphrase-protected review and export, and add a fixed addendum page as the first page inside every booklet, with the inside-page limit moving to 23.

**Architecture:** Booklet imposition gains a fixed `'addendum'` slot at the head of the inside signature (pure logic in `js/booklet.js`, rendered like Glenn's info page by a new `js/addendum.js`). Participant words go through `js/wordentry.js` (page + consent dialog) into `js/wordstore.js` (IndexedDB, separate from the zine autosave, with pure Node-tested helpers). `js/wordreview.js` adds the `?organizer` + passphrase review panel and the approved-words download.

**Tech Stack:** Plain browser JS (no build), IndexedDB, `crypto.subtle`, Node unit tests (`node js/<name>.test.js`), Playwright browser checks (`tests/browser/*.cjs`).

**Spec:** `docs/superpowers/specs/2026-10-02-word-consent-and-addendum-design.md`

## Global Constraints

- Consent dialog text, verbatim: title `May the algorithm reuse your words?`; body `If you agree, your words may appear in other people's zines after the organizer has reviewed them. If you deny consent, your words will not appear again.`; buttons `I consent` / `I do not consent`.
- Storage failure message, verbatim: `Couldn't save on this computer; your words stay on your page.`
- Organizer view only with `?organizer`; Glenn's passphrase (the executor has it from the conversation) is NEVER written into any repo file, docs and tests included — only its SHA-256 hex digest `6cf9cf427aa21396f536de70b00bf21b2865bb0edc1d991860c151dd759aa815`. Wrong entry message: `That's not it.`
- Download file name `approved-words-YYYY-MM-DD.json` (local date); shape `{ app: 'zine-workshop', kind: 'approved-words', exportedAt, words: [{ text, addedAt, approvedAt }] }`.
- Stored words never feed the generator or Randomize; New never touches the word store.
- `MAX_INSIDE_PAGES` = 23 (+ Page, Import Pages, Randomize); `MAX_STORED_INSIDE_PAGES` = 24 (loading keeps up to 24).
- Addendum: slot `'addendum'`, label `Addendum`, first slot of the inside signature (faces Your info); every half-letter booklet; text from `data/addendum.json`.
- **Do not commit.** Glenn commits himself.
- Test tooling: from repo root `~/Documents/repos/ephemera-eternal`, with `S=/tmp/claude-1000/-home-user-repos-ephemera-eternal/bf80e3fb-cb7a-41f7-aaa1-d49199ceef7f/scratchpad`, run browser checks as `CHROME_PATH=$(ls ~/.cache/ms-playwright/chromium_headless_shell-1223/*/chrome-headless-shell) NODE_PATH=$S/node_modules node tests/browser/<name>.cjs`. Full suite: `for t in tests/browser/[!h]*.cjs js/*.test.js; do echo "$t: $(node $t 2>&1 | tail -1)"; done` — every line `0 failed`.

## Review Focus

1. IndexedDB unavailable (private window, blocked storage) when a participant consents — expect the words to stay on their page, the storage-failure notice, and no crash. Pinned in Task 4.
2. An older saved project or autosave with 24 inside pages — expect it to load intact (not cut to 23) and print with the addendum plus one extra sheet. Pinned in Task 1 (Node) and Task 2 (browser restore).
3. `data/addendum.json` missing or broken — expect the PDF export and preview to still complete, with an "Addendum text not set" page. Pinned in Task 2.
4. Organizer reopening the review panel in the same browser session — expect no second passphrase prompt; a fresh browser asks again. Pinned in Task 5.
5. The passphrase leaking into the repo or what the server sends — expect no file to contain it. Pinned in Task 5 Step 7 (in-session check with the phrase in an environment variable, so no file ever holds it).

---

### Task 1: Booklet logic — addendum slot and page limits

**Files:**
- Modify: `js/booklet.js` (constants at line 8, `slotLabel`, `migrateBookletPages`, `bookletSheets`, `importSummary`, `module.exports`)
- Test: `js/booklet.test.js`

**Interfaces:**
- Produces: `MAX_INSIDE_PAGES = 23`, `MAX_STORED_INSIDE_PAGES = 24`; `bookletSheets(insideCount)` whose inside sheets contain the string slot `'addendum'` exactly once (signature index 0) and inside-page numbers `0..insideCount-1`; `slotLabel('addendum') === 'Addendum'`.

- [ ] **Step 1: Update the tests to the new structure (they must fail)**

In `js/booklet.test.js`:

Replace the `fmt` helper line with:
```js
const fmt = slot => slot === null ? '-' : slot === 'addendum' ? 'A' : typeof slot === 'number' ? String(slot + 1) : slot;
```

Replace the whole `[bookletSheets matches Glenn's tables]` block with:
```js
console.log('[bookletSheets: addendum faces Your info, inside pages follow]');
{
    const cover = 'back-cover|front-cover their-info|glenn-info';
    // Inside signature = addendum + inside pages, nested saddle-stitch like Glenn's original tables
    const tables = {
        3:  [cover, '3|A 1|2'],
        7:  [cover, '7|A 1|6', '5|2 3|4'],
        11: [cover, '11|A 1|10', '9|2 3|8', '7|4 5|6'],
        23: [cover, '23|A 1|22', '21|2 3|20', '19|4 5|18', '17|6 7|16', '15|8 9|14', '13|10 11|12']
    };
    Object.entries(tables).forEach(([n, rows]) => {
        assert(`${n} inside pages`, sheetRows(B.bookletSheets(Number(n))).join(' / ') === rows.join(' / '));
    });
}
```

Replace the whole `[bookletSheets padding]` block with:
```js
console.log('[bookletSheets padding]');
{
    for (const n of [1, 4, 5, 6, 24]) {
        const sheets = B.bookletSheets(n);
        const slots = sheets.slice(1).flatMap(s => [...s.front, ...s.back]);
        const numbers = slots.filter(s => typeof s === 'number').sort((a, b) => a - b);
        const padded = Math.ceil((n + 1) / 4) * 4;
        assert(`${n}: every inside page appears exactly once`, numbers.join() === Array.from({ length: n }, (_, i) => i).join());
        assert(`${n}: the addendum appears exactly once`, slots.filter(s => s === 'addendum').length === 1);
        assert(`${n}: blanks fill the rest`, slots.filter(s => s === null).length === padded - n - 1);
        assert(`${n}: cover sheet + ${padded / 4} inside sheets`, sheets.length === 1 + padded / 4);
    }
    for (const n of [3, 7, 11, 15, 19, 23]) {
        assert(`${n} inside pages + addendum fill whole sheets, no blanks`,
            B.bookletSheets(n).slice(1).flatMap(s => [...s.front, ...s.back]).every(s => s !== null));
    }
    assert('6 pages: blanks are the last two slots', sheetRows(B.bookletSheets(6))[1] === '-|A 1|6');
    assert('a 24-page project prints with one extra sheet', B.bookletSheets(24).length === 1 + 7);
}
```

In `[sidesInPrintOrder]`, change `const sheets = B.bookletSheets(8);` to `const sheets = B.bookletSheets(7);` (7 + addendum = 2 inside sheets, so the expected strings stay the same).

In `[migrateBookletPages]`, after `assert('reports 6 dropped', tooMany.dropped === 6);` add:
```js
    assert('limits: 23 to add, 24 kept on load', B.MAX_INSIDE_PAGES === 23 && B.MAX_STORED_INSIDE_PAGES === 24);
    assert('a saved 24-page project loads intact', B.insideIndexes(B.migrateBookletPages(inside(24), newId).pages).length === 24);
```

In the `[labels]` block (find the `slotLabel` assertions), add:
```js
    assert('addendum label', B.slotLabel('addendum') === 'Addendum');
```

In the import-limit test, replace:
```js
    const full = B.migrateBookletPages(inside(23), newId).pages;
    const capped = B.importInsidePages(full, [booklet], newId);
    assert('stops at 24 inside pages', B.insideIndexes(capped.pages).length === 24 && capped.imported === 1 && capped.skipped === 1);
```
with:
```js
    const full = B.migrateBookletPages(inside(22), newId).pages;
    const capped = B.importInsidePages(full, [booklet], newId);
    assert('stops at 23 inside pages', B.insideIndexes(capped.pages).length === 23 && capped.imported === 1 && capped.skipped === 1);
```
Search the file for `24-page limit` and change any expected string to `23-page limit`.

- [ ] **Step 2: Run to verify they fail**

Run: `node js/booklet.test.js`
Expected: FAILs on the addendum tables, padding, limits and label.

- [ ] **Step 3: Implement**

In `js/booklet.js`, replace `const MAX_INSIDE_PAGES = 24;` with:
```js
const MAX_INSIDE_PAGES = 23;          // + Page, Import Pages and Randomize stop here (with the addendum: 24)
const MAX_STORED_INSIDE_PAGES = 24;   // loading keeps up to this many, so older 24-page projects stay whole
```
Update the file's header comment so it mentions the addendum slot alongside `'glenn-info'` ("The addendum ('addendum', from data/addendum.json, never in state.pages) is the first page of the inside signature, facing Your info.").

In `slotLabel`, after the `glenn-info` line add:
```js
    if (slot === 'addendum') return 'Addendum';
```

In `migrateBookletPages`, change `inside.slice(0, MAX_INSIDE_PAGES)` to `inside.slice(0, MAX_STORED_INSIDE_PAGES)`.

Replace `bookletSheets` and its comment with:
```js
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
```

In `importSummary`, change `` `, skipped ${result.skipped} (24-page limit)` `` to `` `, skipped ${result.skipped} (${MAX_INSIDE_PAGES}-page limit)` ``.

Add `MAX_STORED_INSIDE_PAGES` to `module.exports` next to `MAX_INSIDE_PAGES`.

- [ ] **Step 4: Run to verify they pass**

Run: `node js/booklet.test.js`
Expected: `N passed, 0 failed`.

- [ ] **Step 5: Leave uncommitted.**

---

### Task 2: Addendum page in Preview and PDF; limits in the app

**Files:**
- Create: `js/addendum.js`, `data/addendum.json`
- Modify: `index.html` (script tag after `js/organizer.js`), `css/editor.css` (after the `.opening-night-missing` rule), `js/export.js` (`imageFor` in `buildBookletPdf`), `js/editor.js` (`previewSlot`, `renderReadingPreview`, `Addendum.init()` after `Organizer.init();`), `js/autosave.js:148`, `js/store.js:126`
- Test: `tests/browser/booklet-export.cjs`, `tests/browser/booklet-preview.cjs`, `tests/browser/booklet-structure.cjs`, `tests/browser/info-and-import.cjs`, `tests/browser/randomize.cjs`

**Interfaces:**
- Consumes from Task 1: `bookletSheets` with `'addendum'`, `slotLabel('addendum')`, `MAX_INSIDE_PAGES` (23), `MAX_STORED_INSIDE_PAGES` (24).
- Produces: `Addendum.init()`, `Addendum.data`, `buildAddendumPage() → HTMLElement` with class `addendum-page`.

- [ ] **Step 1: Update the browser checks (they must fail)**

`tests/browser/booklet-export.cjs`:
- In the html2canvas wrapper, replace the `label` line with:
```js
            const label = el.classList.contains('organizer-page') ? "Glenn's info"
                : el.classList.contains('addendum-page') ? 'Addendum'
                : pageLabel(state.pages, state.currentPage);
```
- Duplex expectation becomes:
```js
        '1L Back cover', '1R Front cover', '2L Your info', "2R Glenn's info",
        '3R Addendum', '4L Page 1', '5L Page 5', '5R Page 2', '6L Page 3', '6R Page 4'
```
- Two-pass expectation becomes:
```js
        '1L Back cover', '1R Front cover', '2R Addendum', '3L Page 5', '3R Page 2',
        '4L Your info', "4R Glenn's info", '5L Page 1', '6L Page 3', '6R Page 4'
```
- After the missing-organizer check, add:
```js
    console.log('[missing addendum text]');
    const noAddendum = await page.evaluate(async () => {
        const saved = Addendum.data;
        Addendum.data = null;
        const text = buildAddendumPage().textContent;
        const pdf = await buildBookletPdf('duplex');
        Addendum.data = saved;
        return { text, count: pdf.getNumberOfPages() };
    });
    assert('a missing addendum file still exports, with a placeholder page', noAddendum.text === 'Addendum text not set' && noAddendum.count === 6);
```

`tests/browser/booklet-preview.cjs`:
- Reading order expectation: `"Front cover,Your info,Addendum,Glenn's info,Page 1,Page 2,Page 3,Page 4,Page 5,Back cover"` (rename the assertion to `'reading order: Your info, addendum, Glenn's info'`).
- Booklet captions expectation: `"Back cover,Front cover,Your info,Glenn's info,Blank,Addendum,Page 1,Blank,Page 5,Page 2,Page 3,Page 4"`.
- After the reading-order assertion add:
```js
    assert('the addendum page shows its heading', await page.$eval('#preview-pages .addendum-page', el => el.textContent.includes('About the words in this zine')));
```

`tests/browser/booklet-structure.cjs`: rename `[24-page cap]` to `[23-page cap]`, and the assertion to `assert('stops at 23 inside pages', await page.evaluate(() => insideIndexes(state.pages).length === 23));`. Update the file's first comment line to "the 23-page cap". Leave the restore test (30 pages → "6 pages beyond the 24-page limit") as is: the stored limit is still 24. After it, add:
```js
    console.log('[a saved 24-page zine restores whole]');
    await page.evaluate(async () => {
        const pages = Array.from({ length: 24 }, (_, i) => ({ id: i + 1, role: 'inside', elements: [] }));
        Autosave.enabled = false;
        await Autosave.request('readwrite', store => store.put(JSON.stringify({ app: 'zine-workshop', version: 1, pageFormat: 'half-letter', currentPage: 0, meta: {}, pages }), 'current'));
    });
    await page.reload();
    await page.waitForFunction(() => typeof Autosave !== 'undefined' && Autosave.enabled);
    assert('all 24 inside pages come back', await page.evaluate(() => insideIndexes(state.pages).length === 24));
```

`tests/browser/info-and-import.cjs`: change `< 23` to `< 22` in the fill loop, and the two assertions to:
```js
    assert('stops at 23 and reports the skipped page', (await page.$eval('#save-notice', n => n.textContent)).includes('skipped 1 (23-page limit)'));
    assert('23 inside pages', await page.evaluate(() => insideIndexes(state.pages).length === 23));
```

`tests/browser/randomize.cjs`: first comment line "the random 23-page booklet"; replace `27` with `26` in the three page-count checks (`after.roles.length === 26`, `state.pages.length === 26`, `night.count === 26`), the label `'26 pages: front cover, Your info, 23 inside, back cover'`, `after.roles[25] === 'back-cover'` (was `[26]`), and `.length === 23` for the inside count.

- [ ] **Step 2: Run them to verify they fail**

Run each of the five files. Expected: FAILs (no `Addendum`, no `addendum-page`, old limits).

- [ ] **Step 3: Implement**

Create `data/addendum.json`:
```json
{
  "heading": "About the words in this zine",
  "paragraphs": [
    "The words in this zine come from an array of sources: a vocabulary drawn from local news coverage of gentrification and Uncle Lou's, archival flyers, documentary photographs, and lines contributed by workshop participants. They have been evaluated for sensitivity before use.",
    "Because these compositions are made by an algorithm, I cannot assume responsibility for every combination it produces, and some pages may be upsetting or offensive. My efforts behind the scenes are committed to keeping this system from being abused, but printed matter made by others may contain upsetting themes or topics."
  ]
}
```

Create `js/addendum.js`:
```js
// addendum.js — the addendum: the first page inside every half-letter booklet's cover, facing
// Your info. Text comes from data/addendum.json; like Glenn's info page it is fixed, never in
// state.pages, and appears only in the Preview and the PDF.

const Addendum = {
    data: null,

    init: function () {
        fetch('data/addendum.json')
            .then(r => r.json())
            .then(data => { Addendum.data = data; })
            .catch(() => { Addendum.data = null; });
    }
};

function buildAddendumPage() {
    const page = document.createElement('div');
    page.className = 'addendum-page';
    const add = (tag, className, text) => {
        const el = document.createElement(tag);
        if (className) el.className = className;
        el.textContent = text;
        page.appendChild(el);
    };
    const data = Addendum.data;
    if (!data || !Array.isArray(data.paragraphs) || data.paragraphs.length === 0) {
        add('p', 'addendum-missing', 'Addendum text not set');
        return page;
    }
    if (data.heading) add('h2', 'addendum-heading', data.heading);
    data.paragraphs.forEach(text => add('p', '', text));
    return page;
}
```

In `index.html`, after `<script src="js/organizer.js"></script>` add `<script src="js/addendum.js"></script>`.

In `css/editor.css`, after the `.opening-night-missing { ... }` rule add:
```css
/* Addendum: first page inside every booklet, same paper as Glenn's info page */
.addendum-page {
    width: 528px;
    height: 816px;
    box-sizing: border-box;
    padding: 72px 64px;
    background: #f8f8f0;
    color: #1a1a1a;
    font-family: 'Liberation Mono', monospace;
    font-size: 12px;
    line-height: 1.5;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1em;
    overflow: hidden;
}

.addendum-page p,
.addendum-heading {
    margin: 0;
}

.addendum-heading {
    font-size: 15px;
}

.addendum-missing {
    color: #888;
    text-align: center;
}
```

In `js/export.js` `imageFor`, replace the `const canvas = ...` expression with:
```js
            const canvas = slot === 'glenn-info' ? await captureFixedPage(buildOrganizerPage(state.organizer))
                : slot === 'addendum' ? await captureFixedPage(buildAddendumPage())
                : OpeningNight.replaces(slot) ? await captureFixedPage(OpeningNight.buildPage())
                : await captureEditorPage(slotPageIndex(state.pages, slot));
```

In `js/editor.js` `previewSlot`, after the `glenn-info` line add:
```js
            if (slot === 'addendum') return buildAddendumPage();
```
In `renderReadingPreview`, inside `if (isBooklet && page.role === 'their-info') {`, before the Glenn's info line add:
```js
                    container.appendChild(captioned(previewSlot('addendum'), slotLabel('addendum')));
```
After `Organizer.init();` in the `DOMContentLoaded` handler add `Addendum.init();`.

In `js/autosave.js:148` and `js/store.js:126`, change `${MAX_INSIDE_PAGES}` to `${MAX_STORED_INSIDE_PAGES}` (these messages are about pages dropped on load).

- [ ] **Step 4: Run to verify they pass**

Run the five browser files plus `node js/booklet.test.js`. Expected: each `0 failed`.

- [ ] **Step 5: Leave uncommitted.**

---

### Task 3: Word store (IndexedDB + pure helpers)

**Files:**
- Create: `js/wordstore.js`
- Test: `js/wordstore.test.js`

**Interfaces:**
- Produces (globals in browser; pure ones exported in Node):
  - `makeWordEntry(text: string, now: Date, id: string) → { id, text, status: 'pending', addedAt }`
  - `approveWordEntry(entry, now: Date) → entry with status 'approved', approvedAt`
  - `unapproveWordEntry(entry) → entry with status 'pending', no approvedAt`
  - `approvedWordsFile(entries, now: Date) → { app, kind: 'approved-words', exportedAt, words: [{ text, addedAt, approvedAt }] }`
  - `approvedWordsFileName(now: Date) → 'approved-words-YYYY-MM-DD.json'` (local date)
  - `WordStore.add(text) → Promise`, `WordStore.all() → Promise<entry[]>` (oldest first), `WordStore.put(entry)`, `WordStore.remove(id)`, `WordStore.clearApproved()`

- [ ] **Step 1: Write the failing test**

Create `js/wordstore.test.js`:
```js
/**
 * wordstore.test.js — Node.js test for the pure helpers in wordstore.js (entries, approval,
 * the approved-words export). The IndexedDB part is covered by the browser checks.
 */

'use strict';

const W = require('./wordstore.js');

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}

const t1 = new Date(2026, 9, 2, 14, 30);
const t2 = new Date(2026, 9, 3, 9, 5);

console.log('[entries]');
{
    const e = W.makeWordEntry('  the corner store remembers  ', t1, 'a1');
    assert('trimmed text, pending, stamped', e.text === 'the corner store remembers' && e.status === 'pending' && e.addedAt === t1.toISOString() && e.id === 'a1');
    const ok = W.approveWordEntry(e, t2);
    assert('approve stamps approvedAt', ok.status === 'approved' && ok.approvedAt === t2.toISOString() && ok.text === e.text);
    assert('approve leaves the original alone', e.status === 'pending' && !('approvedAt' in e));
    const back = W.unapproveWordEntry(ok);
    assert('undo returns to pending without approvedAt', back.status === 'pending' && !('approvedAt' in back));
}

console.log('[export]');
{
    const entries = [
        W.approveWordEntry(W.makeWordEntry('kept', t1, 'a'), t2),
        W.makeWordEntry('still pending', t1, 'b')
    ];
    const file = W.approvedWordsFile(entries, t2);
    assert('file shape', file.app === 'zine-workshop' && file.kind === 'approved-words' && file.exportedAt === t2.toISOString());
    assert('only approved words, with their dates', file.words.length === 1 && file.words[0].text === 'kept' &&
        file.words[0].addedAt === t1.toISOString() && file.words[0].approvedAt === t2.toISOString() && !('id' in file.words[0]));
    assert('file name uses the local date', W.approvedWordsFileName(t2) === 'approved-words-2026-10-03.json');
    assert('empty list exports an empty words array', W.approvedWordsFile([], t2).words.length === 0);
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run to verify it fails**

Run: `node js/wordstore.test.js`
Expected: `Cannot find module './wordstore.js'`.

- [ ] **Step 3: Implement**

Create `js/wordstore.js`:
```js
// wordstore.js — participants' consented words, kept in this browser's IndexedDB apart from the
// zine autosave, so they survive New. Nothing here feeds the generator or Randomize: Glenn reviews
// entries in the organizer view (wordreview.js) and merges approved ones into data/grammar.json by
// hand. The entry and export helpers are pure (Node-tested); WordStore wraps the IndexedDB calls.

function makeWordEntry(text, now, id) {
    return { id, text: String(text).trim(), status: 'pending', addedAt: now.toISOString() };
}

function approveWordEntry(entry, now) {
    return Object.assign({}, entry, { status: 'approved', approvedAt: now.toISOString() });
}

function unapproveWordEntry(entry) {
    const copy = Object.assign({}, entry, { status: 'pending' });
    delete copy.approvedAt;
    return copy;
}

function approvedWordsFile(entries, now) {
    return {
        app: 'zine-workshop',
        kind: 'approved-words',
        exportedAt: now.toISOString(),
        words: entries.filter(e => e.status === 'approved').map(e => ({ text: e.text, addedAt: e.addedAt, approvedAt: e.approvedAt }))
    };
}

function approvedWordsFileName(now) {
    const pad = n => String(n).padStart(2, '0');
    return `approved-words-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

const WordStore = {
    DB: 'zine-workshop-words',
    STORE: 'entries',
    dbPromise: null,

    open: function () {
        if (!WordStore.dbPromise) {
            WordStore.dbPromise = new Promise((resolve, reject) => {
                const req = indexedDB.open(WordStore.DB, 1);
                req.onupgradeneeded = () => req.result.createObjectStore(WordStore.STORE, { keyPath: 'id' });
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            WordStore.dbPromise.catch(() => { WordStore.dbPromise = null; });   // let a later call retry
        }
        return WordStore.dbPromise;
    },

    request: async function (mode, action) {
        const db = await WordStore.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(WordStore.STORE, mode);
            const req = action(tx.objectStore(WordStore.STORE));
            tx.oncomplete = () => resolve(req && req.result);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    },

    add: function (text) {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        return WordStore.request('readwrite', store => store.put(makeWordEntry(text, new Date(), id)));
    },

    all: async function () {
        const list = await WordStore.request('readonly', store => store.getAll());
        return (list || []).sort((a, b) => a.addedAt.localeCompare(b.addedAt));
    },

    put: entry => WordStore.request('readwrite', store => store.put(entry)),
    remove: id => WordStore.request('readwrite', store => store.delete(id)),

    clearApproved: async function () {
        const approved = (await WordStore.all()).filter(e => e.status === 'approved');
        await Promise.all(approved.map(e => WordStore.remove(e.id)));
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { makeWordEntry, approveWordEntry, unapproveWordEntry, approvedWordsFile, approvedWordsFileName };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node js/wordstore.test.js`
Expected: `Results: N passed, 0 failed`.

- [ ] **Step 5: Leave uncommitted.**

---

### Task 4: Word entry box and consent dialog (participant)

**Files:**
- Create: `js/wordentry.js`
- Modify: `index.html` (Word Bank block in `.generator-panel`; consent modal after `#randomize-done-modal`; script tags `js/wordstore.js`, `js/wordentry.js` after `js/randomize.js`), `js/generator.js` (remove word bank), `js/export.js:174` (remove `Generator.renderWordBank();`), `js/editor.js` (`WordEntry.init();` after `Randomize.init();`), `css/generator.css` (word-bank rules → word-entry)
- Delete: `js/generator.test.js` (its only subject, `addWordToGrammar`, is removed)
- Test: `tests/browser/word-consent.cjs`

**Interfaces:**
- Consumes from Task 3: `WordStore.add(text)`, `WordStore.all()`. From the app: `createTextElement`, `addElement`, `randomFontLists`, `fontSources`, `state.fonts`, `Autosave.showNotice(message)`.
- Produces: `WordEntry.init()`, `WordEntry.add()`, `WordEntry.answer(consented: boolean)`; DOM ids `word-entry`, `word-entry-add-btn`, `word-consent-modal`, `word-consent-quote`, `word-consent-yes-btn`, `word-consent-no-btn`.

- [ ] **Step 1: Write the failing browser check**

Create `tests/browser/word-consent.cjs`:
```js
// word-consent.cjs — the "Add a word or line…" box: words land on the participant's page, consent
// stores them for review, anything else stores nothing, and stored words never reach the vocabulary.
'use strict';

const { open, assert, done } = require('./harness.cjs');

(async () => {
    const { page, close } = await open();
    const shown = () => page.$eval('#word-consent-modal', el => el.classList.contains('show'));
    const stored = () => page.evaluate(async () => (await WordStore.all()).map(e => `${e.status}:${e.text}`));
    const addWords = async (text) => {
        await page.fill('#word-entry', text);
        await page.click('#word-entry-add-btn');
    };

    console.log('[the box]');
    const box = await page.$eval('#word-entry', el => ({ tag: el.tagName, rows: el.rows, placeholder: el.placeholder }));
    assert('a 3-row text box saying "Add a word or line…"', box.tag === 'TEXTAREA' && box.rows === 3 && box.placeholder === 'Add a word or line…');
    assert('no category select and no word list', await page.evaluate(() =>
        !document.getElementById('word-bank-symbol-select') && !document.getElementById('word-bank-list') && !document.getElementById('word-bank-input')));

    console.log('[Add puts the words on the page and asks]');
    await addWords('the corner store remembers');
    assert('words are on the current page', await page.evaluate(() => getCurrentPage().elements.some(e => e.type === 'text' && e.content === 'the corner store remembers')));
    assert('box cleared', (await page.inputValue('#word-entry')) === '');
    assert('consent dialog opens', await shown());
    const dialog = await page.textContent('#word-consent-modal');
    assert('dialog quotes the words and says they will not appear again if denied',
        dialog.includes('May the algorithm reuse your words?') && dialog.includes('the corner store remembers') &&
        dialog.includes('If you deny consent, your words will not appear again.'));

    console.log('[I consent]');
    await page.click('#word-consent-yes-btn');
    await page.waitForFunction(async () => (await WordStore.all()).length === 1);
    assert('stored once, pending', JSON.stringify(await stored()) === JSON.stringify(['pending:the corner store remembers']));

    console.log('[I do not consent / Escape / outside click]');
    await addWords('keep this to myself');
    await page.click('#word-consent-no-btn');
    await addWords('escape hatch');
    await page.keyboard.press('Escape');
    await addWords('clicked away');
    await page.mouse.click(5, 5);
    await page.waitForTimeout(200);
    assert('dialog closed', !(await shown()));
    assert('nothing more stored', (await stored()).length === 1);
    assert('denied words still on the participant\'s page', await page.evaluate(() =>
        ['keep this to myself', 'escape hatch', 'clicked away'].every(t => getCurrentPage().elements.some(e => e.content === t))));

    console.log('[New keeps the stored words; they never reach the vocabulary]');
    await page.click('#new-zine-btn');
    await page.waitForTimeout(300);
    assert('store survives New', (await stored()).length === 1);
    assert('grammar does not contain stored words', await page.evaluate(() => !JSON.stringify(state.grammar).includes('the corner store remembers')));
    await page.waitForFunction(() => state.photoImages.length && state.clipartImages.length && state.grammar.slogan);
    assert('Randomize does not use stored words', await page.evaluate(() => {
        Randomize.apply();
        return !JSON.stringify(state.pages).includes('the corner store remembers');
    }));
    await page.evaluate(() => Randomize.finish());

    console.log('[storage unavailable]');
    await page.evaluate(() => { WordStore.add = () => Promise.reject(new Error('blocked')); });
    await addWords('private window words');
    await page.click('#word-consent-yes-btn');
    await page.waitForSelector('#save-notice');
    assert('notice says the words stay on the page', (await page.$eval('#save-notice', n => n.textContent))
        .includes("Couldn't save on this computer; your words stay on your page."));
    assert('words still on the page', await page.evaluate(() => getCurrentPage().elements.some(e => e.content === 'private window words')));

    await close();
    done();
})();
```

- [ ] **Step 2: Run to verify it fails**

Run: `... node tests/browser/word-consent.cjs`
Expected: FAIL — `#word-entry` not found.

- [ ] **Step 3: Replace the Word Bank markup**

In `index.html`, replace:
```html
                <h3 style="margin-top: 12px;">Word Bank</h3>
                <select id="word-bank-symbol-select"></select>
                <input type="text" id="word-bank-input" placeholder="Add a word or line…">
                <button class="tool-btn" id="word-bank-add-btn">Add</button>
                <ul class="word-bank-list" id="word-bank-list"></ul>
```
with:
```html
                <textarea id="word-entry" class="word-entry" rows="3" placeholder="Add a word or line…"></textarea>
                <button class="tool-btn" id="word-entry-add-btn">Add</button>
```

After the closing `</div>` of `#randomize-done-modal`, add:
```html
    <!-- Participant words: consent to reuse after Glenn's review -->
    <div class="preview-modal" id="word-consent-modal" role="dialog" aria-modal="true" aria-labelledby="word-consent-title">
        <div class="booklet-export-dialog">
            <h2 id="word-consent-title">May the algorithm reuse your words?</h2>
            <p class="word-consent-quote" id="word-consent-quote"></p>
            <p class="booklet-export-note">If you agree, your words may appear in other people's zines after the organizer has reviewed them. If you deny consent, your words will not appear again.</p>
            <button class="btn" id="word-consent-yes-btn">I consent</button>
            <button class="btn btn-tertiary" id="word-consent-no-btn">I do not consent</button>
        </div>
    </div>
```

After `<script src="js/randomize.js"></script>` add:
```html
    <script src="js/wordstore.js"></script>
    <script src="js/wordentry.js"></script>
```

In `css/generator.css`, replace the `.word-bank-list { ... }` and `.word-bank-list li { ... }` rules with:
```css
.word-entry {
    width: 100%;
    box-sizing: border-box;
    margin-top: 12px;
    padding: 6px;
    font-family: inherit;
    font-size: 12px;
    resize: vertical;
}
```
and in `css/editor.css` after `.randomize-ibm { ... }` add:
```css
.word-consent-quote {
    margin: 0 0 8px;
    font-size: 14px;
    font-style: italic;
    overflow-wrap: anywhere;
}
```

- [ ] **Step 4: Remove the old Word Bank code**

In `js/generator.js`:
- Delete the `addWordToGrammar` function.
- In `init`, delete both `this.renderWordBank();` lines and the two listeners for `word-bank-add-btn` and `word-bank-symbol-select`.
- Delete the `addWord` and `renderWordBank` methods (and the comma before them so the object literal stays valid).
- Update the header comment to: `// generator.js — poetry generator panel: pick a symbol, generate a Tracery line, insert it as a text element or reroll.`

In `js/export.js`, delete the line `Generator.renderWordBank();`.

Delete `js/generator.test.js`.

- [ ] **Step 5: Add the entry logic**

Create `js/wordentry.js`:
```js
// wordentry.js — the "Add a word or line…" box. The words go onto the participant's own page right
// away; then they are asked whether the algorithm may reuse them. Consent stores them as pending
// for Glenn's review (wordstore.js); no, Escape or clicking away stores nothing.

const WordEntry = {
    waiting: null,   // the words waiting on the consent answer

    init: function () {
        const modal = document.getElementById('word-consent-modal');
        document.getElementById('word-entry-add-btn').addEventListener('click', WordEntry.add);
        document.getElementById('word-consent-yes-btn').addEventListener('click', () => WordEntry.answer(true));
        document.getElementById('word-consent-no-btn').addEventListener('click', () => WordEntry.answer(false));
        modal.addEventListener('click', e => { if (e.target === modal) WordEntry.answer(false); });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && modal.classList.contains('show')) WordEntry.answer(false);
        });
    },

    add: function () {
        const box = document.getElementById('word-entry');
        const text = box.value.trim();
        if (!text) return;
        box.value = '';
        const fonts = randomFontLists(fontSources, state.fonts).readable;
        addElement(Object.assign(createTextElement(100, 100), {
            content: text, w: 300, h: 80, font: fonts[Math.floor(Math.random() * fonts.length)]
        }));
        WordEntry.waiting = text;
        document.getElementById('word-consent-quote').textContent = `“${text}”`;
        document.getElementById('word-consent-modal').classList.add('show');
    },

    answer: async function (consented) {
        document.getElementById('word-consent-modal').classList.remove('show');
        const text = WordEntry.waiting;
        WordEntry.waiting = null;
        if (!consented || !text) return;
        try {
            await WordStore.add(text);
        } catch (e) {
            Autosave.showNotice("Couldn't save on this computer; your words stay on your page.");
        }
    }
};
```

In `js/editor.js`, after `Randomize.init();` add `WordEntry.init();`.

- [ ] **Step 6: Run to verify it passes**

Run: `... node tests/browser/word-consent.cjs`
Expected: `N passed, 0 failed`. Then run the full suite (Global Constraints) — every line `0 failed` (the deleted `js/generator.test.js` no longer appears).

- [ ] **Step 7: Leave uncommitted.**

---

### Task 5: Organizer review (`?organizer` + passphrase), README

**Files:**
- Create: `js/wordreview.js`
- Modify: `index.html` (button after `#randomize-btn`; modal after `#word-consent-modal`; script after `js/wordentry.js`), `js/editor.js` (`WordReview.init();` after `WordEntry.init();`), `css/editor.css` (after `.word-consent-quote`), `README.md`
- Test: `tests/browser/word-review.cjs`

**Interfaces:**
- Consumes from Task 3: `WordStore.all/put/remove/clearApproved`, `approveWordEntry`, `unapproveWordEntry`, `approvedWordsFile`, `approvedWordsFileName`.
- Produces: `WordReview.init()`, DOM ids `word-review-btn`, `word-review-modal`, `word-review-lock`, `word-review-pass`, `word-review-wrong`, `word-review-body`, `word-review-pending`, `word-review-approved`, `word-review-download-btn`, `word-review-clear-btn`, `word-review-close-btn`; list items carry `data-id` and buttons `data-action` = `approve` | `reject` | `undo`.

- [ ] **Step 1: Write the failing browser check**

Create `tests/browser/word-review.cjs`:
```js
// word-review.cjs — Glenn's review of consented words: ?organizer only, passphrase (remembered for
// the session), approve / reject / undo, the approved-words download and clearing.
'use strict';

const fs = require('fs');
const { open, assert, done } = require('./harness.cjs');
const TEST_PHRASE = 'test-only passphrase';   // the real one never appears in the repo

(async () => {
    let session = await open();
    assert('no Review words button on the normal address', await session.page.$eval('#word-review-btn', b => b.hidden));
    await session.close();

    session = await open(undefined, '?organizer');
    const page = session.page;
    // Swap in the digest of a throwaway phrase so this file never needs Glenn's real one
    await page.evaluate(async (phrase) => { WordReview.passHash = await sha256Hex(phrase); }, TEST_PHRASE);
    await page.evaluate(async () => {
        for (const text of ['first line', 'second line', 'third line']) {
            await WordStore.add(text);
            await new Promise(r => setTimeout(r, 5));   // distinct addedAt for ordering
        }
    });
    const items = id => page.$$eval(`#${id} li[data-id]`, lis => lis.map(li => li.querySelector('.word-review-text').textContent));
    const act = async (listId, text, action) => {
        await page.evaluate(({ listId, text, action }) => {
            const li = [...document.querySelectorAll(`#${listId} li[data-id]`)].find(l => l.querySelector('.word-review-text').textContent === text);
            li.querySelector(`button[data-action="${action}"]`).click();
        }, { listId, text, action });
        await page.waitForTimeout(150);
    };

    console.log('[passphrase]');
    assert('Review words button shown with ?organizer', !(await page.$eval('#word-review-btn', b => b.hidden)));
    await page.click('#word-review-btn');
    assert('asks for the passphrase first', !(await page.$eval('#word-review-lock', f => f.hidden)) && await page.$eval('#word-review-body', b => b.hidden));
    await page.fill('#word-review-pass', 'not the passphrase');
    await page.click('#word-review-lock button[type="submit"]');
    await page.waitForTimeout(150);
    assert('wrong phrase refused', !(await page.$eval('#word-review-wrong', p => p.hidden)) && await page.$eval('#word-review-body', b => b.hidden));
    assert('says "That\'s not it."', (await page.textContent('#word-review-wrong')).includes("That's not it."));
    await page.fill('#word-review-pass', TEST_PHRASE);
    await page.click('#word-review-lock button[type="submit"]');
    await page.waitForFunction(() => !document.getElementById('word-review-body').hidden);
    assert('right phrase opens the review', JSON.stringify(await items('word-review-pending')) === JSON.stringify(['first line', 'second line', 'third line']));

    console.log('[approve / reject / undo]');
    await act('word-review-pending', 'first line', 'approve');
    await act('word-review-pending', 'second line', 'reject');
    assert('approved moves over', JSON.stringify(await items('word-review-approved')) === '["first line"]');
    assert('rejected is deleted from the store', await page.evaluate(async () => (await WordStore.all()).map(e => e.text).join() === 'first line,third line'));
    await act('word-review-approved', 'first line', 'undo');
    assert('undo puts it back in pending', (await items('word-review-approved')).length === 0 && (await items('word-review-pending')).includes('first line'));
    await act('word-review-pending', 'first line', 'approve');

    console.log('[session memory]');
    await page.click('#word-review-close-btn');
    await page.click('#word-review-btn');
    assert('no second prompt in the same session', await page.$eval('#word-review-lock', f => f.hidden) && !(await page.$eval('#word-review-body', b => b.hidden)));

    console.log('[download approved]');
    assert('Clear downloaded starts disabled', await page.$eval('#word-review-clear-btn', b => b.disabled));
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#word-review-download-btn')]);
    assert('file name approved-words-YYYY-MM-DD.json', /^approved-words-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()));
    const file = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert('only approved words, documented shape', file.app === 'zine-workshop' && file.kind === 'approved-words' &&
        file.words.length === 1 && file.words[0].text === 'first line' && file.words[0].addedAt && file.words[0].approvedAt);

    console.log('[clear downloaded]');
    assert('Clear enabled after a download', !(await page.$eval('#word-review-clear-btn', b => b.disabled)));
    await page.click('#word-review-clear-btn');   // harness accepts the confirm prompt
    await page.waitForTimeout(200);
    assert('approved emptied, pending kept', await page.evaluate(async () => (await WordStore.all()).map(e => `${e.status}:${e.text}`).join() === 'pending:third line'));

    await session.close();

    console.log('[a fresh browser asks again]');
    session = await open(undefined, '?organizer');
    assert('the shipped digest is set (64 hex chars)', await session.page.evaluate(() => /^[0-9a-f]{64}$/.test(WordReview.passHash)));
    await session.page.click('#word-review-btn');
    assert('prompt shown in a new session', !(await session.page.$eval('#word-review-lock', f => f.hidden)));
    await session.close();
    done();
})();
```

- [ ] **Step 2: Run to verify it fails**

Run: `... node tests/browser/word-review.cjs`
Expected: FAIL — `#word-review-btn` not found.

- [ ] **Step 3: Markup and styles**

In `index.html`, after the `#randomize-btn` button add:
```html
                <button class="btn btn-tertiary" id="word-review-btn" title="Review participants' consented words" hidden>Review words</button>
```
After the closing `</div>` of `#word-consent-modal` add:
```html
    <!-- Organizer: review consented words (only with ?organizer) -->
    <div class="preview-modal" id="word-review-modal" role="dialog" aria-modal="true" aria-labelledby="word-review-title">
        <div class="booklet-export-dialog word-review-dialog">
            <h2 id="word-review-title">Review words</h2>
            <form id="word-review-lock">
                <label for="word-review-pass" class="booklet-export-note">Passphrase</label>
                <input type="password" id="word-review-pass" autocomplete="off">
                <button class="btn" type="submit">Unlock</button>
                <p class="booklet-export-note" id="word-review-wrong" hidden>That's not it.</p>
            </form>
            <div id="word-review-body" hidden>
                <h3>Pending</h3>
                <ul class="word-review-list" id="word-review-pending"></ul>
                <h3>Approved</h3>
                <ul class="word-review-list" id="word-review-approved"></ul>
                <button class="btn" id="word-review-download-btn">Download approved</button>
                <button class="btn btn-tertiary" id="word-review-clear-btn" disabled>Clear downloaded</button>
            </div>
            <button class="btn btn-tertiary" id="word-review-close-btn">Close</button>
        </div>
    </div>
```
After `<script src="js/wordentry.js"></script>` add `<script src="js/wordreview.js"></script>`.

In `css/editor.css`, after `.word-consent-quote { ... }` add:
```css
.word-review-dialog {
    max-width: 560px;
    max-height: 80vh;
    overflow-y: auto;
}

.word-review-dialog h3 {
    margin: 12px 0 4px;
    font-size: 13px;
}

.word-review-list {
    list-style: none;
    margin: 0 0 8px;
    padding: 0;
    font-size: 12px;
}

.word-review-list li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    border-bottom: 1px solid #eee;
}

.word-review-text {
    flex: 1;
    overflow-wrap: anywhere;
}

.word-review-when {
    color: #888;
    font-size: 11px;
}
```

- [ ] **Step 4: The review logic**

Create `js/wordreview.js`:
```js
// wordreview.js — Glenn's review of participants' consented words, shown only with ?organizer.
// A passphrase keeps curious participants out. Only its SHA-256 digest is in this file and the
// check runs in the page, so it deters rather than secures. Approved words are downloaded as a
// file and merged into data/grammar.json by hand; nothing here feeds the generator or Randomize.

const WORD_REVIEW_PASS_SHA256 = '6cf9cf427aa21396f536de70b00bf21b2865bb0edc1d991860c151dd759aa815';

async function sha256Hex(text) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const WordReview = {
    active: new URLSearchParams(location.search).has('organizer'),
    passHash: WORD_REVIEW_PASS_SHA256,
    unlockedHere: false,   // fallback when sessionStorage is blocked

    init: function () {
        if (!WordReview.active) return;
        const modal = document.getElementById('word-review-modal');
        const btn = document.getElementById('word-review-btn');
        btn.hidden = false;
        btn.addEventListener('click', WordReview.open);
        document.getElementById('word-review-lock').addEventListener('submit', WordReview.unlock);
        document.getElementById('word-review-close-btn').addEventListener('click', WordReview.close);
        document.getElementById('word-review-download-btn').addEventListener('click', WordReview.download);
        document.getElementById('word-review-clear-btn').addEventListener('click', WordReview.clear);
        modal.addEventListener('click', e => { if (e.target === modal) WordReview.close(); });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && modal.classList.contains('show')) WordReview.close();
        });
    },

    // Remembered until the browser closes
    isUnlocked: function () {
        try {
            return WordReview.unlockedHere || sessionStorage.getItem('word-review-unlocked') === '1';
        } catch (e) {
            return WordReview.unlockedHere;
        }
    },

    open: async function () {
        document.getElementById('word-review-modal').classList.add('show');
        await WordReview.show();
    },

    show: async function () {
        const unlocked = WordReview.isUnlocked();
        document.getElementById('word-review-lock').hidden = unlocked;
        document.getElementById('word-review-body').hidden = !unlocked;
        if (unlocked) await WordReview.render();
        else document.getElementById('word-review-pass').focus();
    },

    unlock: async function (e) {
        e.preventDefault();
        const input = document.getElementById('word-review-pass');
        const ok = (await sha256Hex(input.value)) === WordReview.passHash;
        input.value = '';
        document.getElementById('word-review-wrong').hidden = ok;
        if (!ok) return;
        WordReview.unlockedHere = true;
        try { sessionStorage.setItem('word-review-unlocked', '1'); } catch (err) { /* this page only */ }
        await WordReview.show();
    },

    render: async function () {
        const entries = await WordStore.all();
        const fill = (listId, status, actions) => {
            const list = document.getElementById(listId);
            list.innerHTML = '';
            const shown = entries.filter(e => e.status === status);
            if (shown.length === 0) {
                const empty = document.createElement('li');
                empty.className = 'word-review-empty';
                empty.textContent = 'None';
                list.appendChild(empty);
            }
            shown.forEach(entry => {
                const li = document.createElement('li');
                li.dataset.id = entry.id;
                const text = document.createElement('span');
                text.className = 'word-review-text';
                text.textContent = entry.text;
                const when = document.createElement('span');
                when.className = 'word-review-when';
                when.textContent = new Date(entry.addedAt).toLocaleString();
                li.append(text, when);
                actions.forEach(([label, run]) => {
                    const b = document.createElement('button');
                    b.className = 'btn btn-tertiary';
                    b.textContent = label;
                    b.dataset.action = label.toLowerCase();
                    b.addEventListener('click', async () => { await run(entry); await WordReview.render(); });
                    li.appendChild(b);
                });
                list.appendChild(li);
            });
        };
        fill('word-review-pending', 'pending', [
            ['Approve', entry => WordStore.put(approveWordEntry(entry, new Date()))],
            ['Reject', entry => WordStore.remove(entry.id)]   // gone for good: "will not appear again"
        ]);
        fill('word-review-approved', 'approved', [
            ['Undo', entry => WordStore.put(unapproveWordEntry(entry))]
        ]);
    },

    download: async function () {
        const now = new Date();
        const file = approvedWordsFile(await WordStore.all(), now);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
        link.download = approvedWordsFileName(now);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        document.getElementById('word-review-clear-btn').disabled = false;
    },

    clear: async function () {
        if (!confirm('Delete every approved word from this computer? Make sure the download worked first.')) return;
        await WordStore.clearApproved();
        document.getElementById('word-review-clear-btn').disabled = true;
        await WordReview.render();
    },

    close: function () {
        document.getElementById('word-review-modal').classList.remove('show');
    }
};
```

In `js/editor.js`, after `WordEntry.init();` add `WordReview.init();`.

- [ ] **Step 5: Run to verify it passes**

Run: `... node tests/browser/word-review.cjs`
Expected: `N passed, 0 failed`.

- [ ] **Step 6: README**

In `README.md`:
- In "Half-letter booklets", change "1–24 inside pages" to "1–23 inside pages" and the sheet description to: "Sheet 1 is the cover sheet (`Back cover | Front cover`, then `Your info | Glenn's info`); the inside signature starts with the addendum (facing Your info), then the inside pages in booklet order, padded with blank pages to a multiple of 4 — 3, 7, 11, 15, 19 or 23 inside pages print with no blanks. Saved projects with 24 inside pages still open whole."
- In the "### Randomize" section, change "a half-letter booklet of 24 inside pages" to "a half-letter booklet of 23 inside pages (24 with the addendum, exactly 7 sheets)".
- Replace the Poetry Generator bullet's Word Bank sentences with: "Below it, an **Add a word or line…** box puts the participant's words on their page and asks for consent to reuse them (see Participant words)."
- Add before `## Browser checks`:
```markdown
### Addendum (`data/addendum.json`)

The first page inside every booklet, facing Your info: where the zine's words come from, that
they were evaluated for sensitivity, and the responsibility note. Fixed like Glenn's info page;
edit the wording in `data/addendum.json` (`heading`, `paragraphs`).

### Participant words and review

**Add a word or line…** puts the words on the participant's current page, then asks "May the
algorithm reuse your words?" (denying means the words will not appear again). Consented words are
kept in that browser's storage, apart from the zine (they survive **New**), as *pending*. They never
reach the generator or Randomize on their own.

Open the tool with `?organizer` for a **Review words** button (passphrase required, remembered
until the browser closes; only its SHA-256 hash is in the code). Approve, reject (deletes it) or
undo, then **Download approved** (`approved-words-YYYY-MM-DD.json`) and, once the file is safe,
**Clear downloaded**. Each computer keeps its own list. Approved words are merged into
`data/grammar.json` by hand, as `origin` lines unless placed elsewhere at merge time.
```
- In the file layout list, add:
```markdown
- `js/addendum.js` — the addendum page from `data/addendum.json`
- `js/wordstore.js` — consented participant words (IndexedDB) + export helpers (pure, Node-tested)
- `js/wordentry.js` — the "Add a word or line…" box and consent dialog
- `js/wordreview.js` — `?organizer` review, passphrase, approved-words download
```
and remove the `js/generator.js` mention of the word bank if present.

- [ ] **Step 7: Full suite, leak and digest checks, then render the addendum**

Run the full suite (Global Constraints). Expected: every line `0 failed`.

With Glenn's passphrase in an environment variable (set for this command only, never saved to a file), check that the shipped digest matches it and that no file in the repo contains it:
```bash
printf '%s' "$WORD_REVIEW_PASS" | sha256sum | grep -q 6cf9cf427aa21396f536de70b00bf21b2865bb0edc1d991860c151dd759aa815 && echo digest-ok
grep -rlF "$WORD_REVIEW_PASS" . --exclude-dir=.git --exclude-dir=node_modules || echo no-leak
```
Expected: `digest-ok` and `no-leak`.

Render sheet 2's front (the addendum side) of a randomized zine with the existing `$S/random-pdf.cjs` (`node $S/random-pdf.cjs $S/random.pdf && pdftoppm -png -r 50 -f 3 -l 3 $S/random.pdf $S/addendum`) and confirm: the addendum shows the heading and both paragraphs, readable, inside the page; the PDF has 14 pages (7 sheets × 2 sides) for a randomized zine.

- [ ] **Step 8: Leave uncommitted.**
