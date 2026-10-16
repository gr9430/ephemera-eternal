# Public Workshop Version Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the plain URL a self-serve public zine maker (welcome, sending words to Glenn, print-and-fold help), move the in-person workshop behind `?workshop`, and give workshop computers a local server that writes consented words into `data/grammar.json`, held back until Glenn approves them.

**Architecture:** A tiny `js/mode.js` reads the address once (`Mode.workshop`, plus `?opening-night` / `?organizer` that only count with `?workshop`) and loads `data/public.json` once for the public version. Three small public-only modules (`welcome.js`, `printhelp.js`, `wordssend.js`) each read that config and add one modal; `generatePDF()` gets two hooks. For workshops, `serve.py` (Python 3 standard library) serves the folder and adds a JSON words API that edits `data/grammar.json` atomically, keeping its exact layout; `wordentry.js` and `wordreview.js` use that API when it answers and fall back to today's IndexedDB flow when it doesn't.

**Tech Stack:** Plain HTML/CSS/JS with browser globals and a `module.exports` guard for Node-tested helpers (as in `js/wordstore.js`), Node test scripts (`node js/<name>.test.js`), Python 3.12 `unittest` (`python3 serve_test.py`), Playwright browser checks (`tests/browser/*.cjs`).

**Spec:** `docs/superpowers/specs/2026-10-11-public-workshop-design.md`

## Global Constraints

- Work on a new branch `public-workshop` off `main`. Stage only the files each task names; never `git add -A` or `git add .`.
- The plain URL is the public version. `?workshop` turns on the workshop. `?opening-night` and `?organizer` work **only** together with `?workshop`; on their own they do nothing.
- `data/public.json` holds `wordsEmail` (`"workshop@gsr.mozmail.com"`), `welcome` (`heading`, `paragraphs`, `steps`) and `printHelp` (`duplex`, `two-pass`, `sheet`, `poster`). A missing or unreadable file turns off the welcome, the send step and the print dialog; the editor still works.
- Exact UI strings: `How to`, `Start`, `You offered N words or lines to the algorithm. Send them to Glenn?` (singular: `1 word or line`), `Download words (.txt)`, `Open email`, `Not now`, `Attach this file to an email to <address>.`, `Continue`, `Too many words for an email link. Download the file and attach it.`, `Print & fold`, `Done`, `Words saved on this computer only.`
- The words file is named `my-words-YYYY-MM-DD.txt` (local date) and starts `Words offered to Ephemera Eternal, YYYY-MM-DD`. The email subject is `Words for Ephemera Eternal`. A `mailto:` link longer than 1,800 characters isn't offered.
- The welcome's "seen" flag is `localStorage` key `ee-welcome-seen`, every access in try/catch. **New** doesn't reset it.
- Double-sided print steps must say **flip on short edge**.
- Word statuses in IndexedDB are `pending`, `approved` (workshop organizer flow only) and `sent` (public only, with `sentAt`).
- `serve.py`: standard library only, binds `127.0.0.1`, default port 8000, `python3 serve.py [port]`. Text is trimmed; empty or over 500 characters is refused with 400; duplicates of a pending or approved line succeed without adding. Writes are a temp file in `data/` plus `os.replace`, under a lock.
- `data/grammar.json` layout is preserved: `{`, then one `  "key": [compact list]` line per symbol separated by `,` and a blank line, then `}` with no trailing newline; non-ASCII as-is. `participant` and `participant_pending` are added after the existing symbols, `participant` first.
- No rule may reference `participant_pending`. `origin` gets a single `"#participant#"` the first time `participant` is non-empty; the server never adds a second one.
- Browser checks run with `NODE_PATH=/home/user/.cache/ephemera-eternal-tools/node_modules node tests/browser/<file>.cjs` (they need network for the html2canvas/jsPDF CDN).

## Review Focus

1. **A participant types `#` or `[ ]`** (a hashtag, "[sic]"). Tracery reads these as markup, so the line would print as `[save ]` or lose words. The server stores look-alikes (`＃ ［ ］`) so the line prints as typed and `tracery.test.js` stays green. Pinned in Task 6.
2. **Glenn un-approves the last approved line.** `origin` would still say `#participant#` with nothing to expand, and zines would print `[participant]`. When `participant` empties, the server removes `#participant#` from `origin`. Pinned in Task 6.
3. **Pending lines showing up in the Poetry Generator's symbol dropdown.** It lists every grammar key, so `participant_pending` would be one click away from unreviewed words. The dropdown skips it. Pinned in Task 7.
4. **Multi-line words** (the box is a textarea, so poems are typical). In the `.txt` file and email body, line breaks inside an entry become ` / `, so it's still one entry per line. Pinned in Task 2.
5. **Over-long words at the workshop.** A 400 from the server must say so, not quietly save the words on this computer as if there were no server. Pinned in Task 7.

---

### Task 1: Mode flags and the `?workshop` switch

**Files:**
- Create: `js/mode.js`
- Create: `js/mode.test.js`
- Modify: `index.html` (script tag)
- Modify: `js/openingnight.js:11`
- Modify: `js/wordreview.js:14`
- Modify: `tests/browser/harness.cjs` (default query)
- Modify: `tests/browser/opening-night.cjs`, `tests/browser/randomize.cjs`, `tests/browser/word-review.cjs`

**Interfaces:**
- Produces: `readMode(search: string) → { workshop: bool, openingNight: bool, organizer: bool }` (Node-exported); global `Mode` (that object for `location.search`); global `loadPublicConfig() → Promise<object|null>` (memoized; `null` in workshop mode or when `data/public.json` is missing, unreadable or not an object). The harness's `open(viewport, query)` now defaults `query` to `'?workshop'`; pass `''` for the public version.

- [ ] **Step 0: Branch**

```bash
git switch -c public-workshop main
```

- [ ] **Step 1: Write the failing test** `js/mode.test.js`

```js
/**
 * mode.test.js — Node.js test for readMode() in mode.js: ?workshop turns on the workshop, and
 * ?opening-night / ?organizer only count together with it.
 */

'use strict';

const { readMode } = require('./mode.js');

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}

const is = (search, workshop, openingNight, organizer) => {
    const m = readMode(search);
    return m.workshop === workshop && m.openingNight === openingNight && m.organizer === organizer;
};

console.log('[flags]');
assert('plain URL is the public version', is('', false, false, false));
assert('?workshop', is('?workshop', true, false, false));
assert('?workshop&opening-night', is('?workshop&opening-night', true, true, false));
assert('?workshop&organizer', is('?workshop&organizer', true, false, true));
assert('order does not matter', is('?opening-night&workshop', true, true, false));
assert('all three', is('?workshop&opening-night&organizer', true, true, true));
assert('?workshop=1 still counts', is('?workshop=1', true, false, false));
assert('a bare ?organizer does nothing', is('?organizer', false, false, false));
assert('a bare ?opening-night does nothing', is('?opening-night', false, false, false));
assert('unrelated flags do nothing', is('?workshops&organiser', false, false, false));

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node js/mode.test.js`
Expected: crashes with `Cannot find module './mode.js'`.

- [ ] **Step 3: Write `js/mode.js`**

```js
// mode.js — which version of the tool this is, read once from the address. The plain URL is the
// public version, for people making a zine at home; workshop computers open ?workshop.
// ?opening-night and ?organizer only count together with ?workshop.

function readMode(search) {
    const params = new URLSearchParams(search);
    const workshop = params.has('workshop');
    return {
        workshop,
        openingNight: workshop && params.has('opening-night'),
        organizer: workshop && params.has('organizer')
    };
}

const Mode = readMode(typeof location !== 'undefined' ? location.search : '');

// data/public.json, fetched once. Resolves null in workshop mode, or when the file is missing or
// unreadable, which turns the public-only features (welcome, sending words, print help) off.
let publicConfigPromise = null;
function loadPublicConfig() {
    if (!publicConfigPromise) {
        publicConfigPromise = Mode.workshop ? Promise.resolve(null)
            : fetch('data/public.json', { cache: 'no-cache' })
                .then(r => (r.ok ? r.json() : null))
                .then(data => (data && typeof data === 'object' && !Array.isArray(data) ? data : null))
                .catch(() => null);
    }
    return publicConfigPromise;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { readMode };
}
```

- [ ] **Step 4: Run the test**

Run: `node js/mode.test.js`
Expected: `Results: 10 passed, 0 failed`.

- [ ] **Step 5: Use `Mode` in the page**

In `index.html`, add the script right after the jsPDF CDN tag, before `js/booklet.js`. `openingnight.js` and `wordreview.js` read `Mode` when they load, so it must come first:

```html
    <script src="js/mode.js"></script>
```

In `js/openingnight.js` replace
`    active: new URLSearchParams(location.search).has('opening-night'),`
with
`    active: Mode.openingNight,`
and in the header comment change "Opening the tool with\n// ?opening-night turns it on" to "Opening the tool with\n// ?workshop&opening-night turns it on". Also change "returns without ?opening-night" to "returns without it".

In `js/wordreview.js` replace
`    active: new URLSearchParams(location.search).has('organizer'),`
with
`    active: Mode.organizer,`
and change the header's "shown only with ?organizer" to "shown only with ?workshop&organizer".

- [ ] **Step 6: Point the browser checks at the workshop**

In `tests/browser/harness.cjs`, change the `open` signature and its comment. The existing checks are all workshop checks:

```js
// query defaults to ?workshop, the in-person version every existing check was written for; pass ''
// for the public version
async function open(viewport = { width: 1600, height: 1000 }, query = '?workshop') {
```

Replace `'?opening-night'` with `'?workshop&opening-night'` in `tests/browser/opening-night.cjs` (line 57) and `tests/browser/randomize.cjs` (line 157). Replace both `'?organizer'` with `'?workshop&organizer'` in `tests/browser/word-review.cjs` (lines 14 and 81).

In `tests/browser/opening-night.cjs`, rename the first section's label from `'[normal address]'` to `'[?workshop alone]'`. After that section's `await session.close();`, add:

```js
    console.log('[a bare ?opening-night does nothing]');
    session = await open(undefined, '?opening-night');
    page = session.page;
    assert('no opening-night label without ?workshop', await page.$eval('#opening-night-badge', el => el.hidden));
    assert('Back cover tab still present', (await tabLabels(page)).includes('Back cover'));
    await session.close();
```

In `tests/browser/word-review.cjs`, right after the first `await session.close();` (the "normal address" check), add:

```js
    session = await open(undefined, '?organizer');
    assert('a bare ?organizer (no ?workshop) shows no Review words button', await session.page.$eval('#word-review-btn', b => b.hidden));
    await session.close();
```

- [ ] **Step 7: Run the affected browser checks**

Run:
```bash
for f in opening-night randomize word-review word-consent; do NODE_PATH=/home/user/.cache/ephemera-eternal-tools/node_modules node tests/browser/$f.cjs | tail -1; done
```
Expected: each prints `N passed, 0 failed`.

- [ ] **Step 8: Commit**

```bash
git add js/mode.js js/mode.test.js index.html js/openingnight.js js/wordreview.js tests/browser/harness.cjs tests/browser/opening-night.cjs tests/browser/randomize.cjs tests/browser/word-review.cjs
git commit -m "Mode: the plain URL is public, ?workshop turns on the workshop

?opening-night and ?organizer now only count with ?workshop.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Word-sending helpers

**Files:**
- Modify: `js/wordstore.js`
- Test: `js/wordstore.test.js`

**Interfaces:**
- Consumes: entries shaped `{ id, text, status, addedAt }` from `makeWordEntry`.
- Produces (globals in the page, exported for Node): `markWordSent(entry, now: Date) → entry` (copy, `status: 'sent'`, `sentAt` ISO); `wordsTextFile(entries, now) → string`; `wordsTextFileName(now) → 'my-words-YYYY-MM-DD.txt'`; `wordsMailto(address: string, entries, now) → string | null`; constant `WORDS_MAILTO_MAX = 1800`.

- [ ] **Step 1: Write the failing tests.** In `js/wordstore.test.js`, insert before the final `console.log(\`\nResults…`:

```js
console.log('[sent]');
{
    const e = W.makeWordEntry('mine', t1, 'c');
    const sent = W.markWordSent(e, t2);
    assert('marked sent with sentAt', sent.status === 'sent' && sent.sentAt === t2.toISOString() && sent.text === 'mine' && sent.id === 'c');
    assert('the original stays pending', e.status === 'pending' && !('sentAt' in e));
}

console.log('[words file]');
{
    const entries = [W.makeWordEntry('the corner store remembers', t1, 'a'), W.makeWordEntry('rent is a\nfour-letter\r\nword', t1, 'b')];
    assert('header, blank line, one entry per line, a line break inside an entry as " / "',
        W.wordsTextFile(entries, t2) === 'Words offered to Ephemera Eternal, 2026-10-03\n\nthe corner store remembers\nrent is a / four-letter / word\n');
    assert('file name uses the local date', W.wordsTextFileName(t2) === 'my-words-2026-10-03.txt');
}

console.log('[mailto]');
{
    const entries = [W.makeWordEntry('rent & "taxes" #1 at 100% — café ✊?', t1, 'a')];
    const url = W.wordsMailto('workshop@gsr.mozmail.com', entries, t2);
    assert('address and subject', url.startsWith('mailto:workshop@gsr.mozmail.com?subject=Words%20for%20Ephemera%20Eternal&body='));
    assert('only the one & separator and no raw # survive encoding', url.split('&').length === 2 && !url.includes('#'));
    const body = decodeURIComponent(url.split('&body=')[1]);
    assert('body is the words file, with CRLF line ends', body === W.wordsTextFile(entries, t2).replace(/\n/g, '\r\n'));

    const line = n => W.makeWordEntry('x'.repeat(n), t1, 'l' + n);
    const base = W.wordsMailto('a@b.c', [line(1)], t2).length - 1;   // everything but the entry's text
    assert('exactly 1,800 characters is offered', W.wordsMailto('a@b.c', [line(W.WORDS_MAILTO_MAX - base)], t2).length === W.WORDS_MAILTO_MAX);
    assert('1,801 characters is not (null)', W.wordsMailto('a@b.c', [line(W.WORDS_MAILTO_MAX - base + 1)], t2) === null);
}
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node js/wordstore.test.js`
Expected: `TypeError: W.markWordSent is not a function`.

- [ ] **Step 3: Implement in `js/wordstore.js`**

Replace the header comment with:

```js
// wordstore.js — participants' consented words, kept in this browser's IndexedDB apart from the
// zine autosave, so they survive New. Nothing here feeds the generator or Randomize. At a workshop
// without serve.py, Glenn reviews entries in the organizer view (wordreview.js) and merges approved
// ones into data/grammar.json by hand. In the public version, pending words are offered at Save as
// PDF (wordssend.js) and marked sent once handed over. The entry, export and sending helpers are
// pure (Node-tested); WordStore wraps the IndexedDB calls.
```

Replace `approvedWordsFileName` with a shared date stamp and add the new helpers after it:

```js
// YYYY-MM-DD in local time, as people read the date
function localDateStamp(now) {
    const pad = n => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function approvedWordsFileName(now) {
    return `approved-words-${localDateStamp(now)}.json`;
}

function markWordSent(entry, now) {
    return Object.assign({}, entry, { status: 'sent', sentAt: now.toISOString() });
}

// One entry per line; a line break inside an entry becomes " / ", as when quoting a poem
function wordsTextFile(entries, now) {
    const lines = entries.map(e => e.text.split(/\r?\n/).map(s => s.trim()).filter(Boolean).join(' / '));
    return [`Words offered to Ephemera Eternal, ${localDateStamp(now)}`, '', ...lines].join('\n') + '\n';
}

function wordsTextFileName(now) {
    return `my-words-${localDateStamp(now)}.txt`;
}

// Mail apps and browsers cut off long mailto: links, so past this the file is the only way
const WORDS_MAILTO_MAX = 1800;

function wordsMailto(address, entries, now) {
    const body = wordsTextFile(entries, now).replace(/\n/g, '\r\n');
    const url = `mailto:${address}?subject=${encodeURIComponent('Words for Ephemera Eternal')}&body=${encodeURIComponent(body)}`;
    return url.length > WORDS_MAILTO_MAX ? null : url;
}
```

Update the export line:

```js
    module.exports = {
        makeWordEntry, approveWordEntry, unapproveWordEntry, approvedWordsFile, approvedWordsFileName,
        markWordSent, wordsTextFile, wordsTextFileName, wordsMailto, WORDS_MAILTO_MAX
    };
```

- [ ] **Step 4: Run the test**

Run: `node js/wordstore.test.js`
Expected: `Results: 17 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add js/wordstore.js js/wordstore.test.js
git commit -m "Word store: helpers for sending words (sent status, .txt file, mailto link)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Public config and the welcome

**Files:**
- Create: `data/public.json`
- Create: `js/welcome.js`
- Create: `tests/browser/public-mode.cjs`
- Modify: `index.html` (How to button, welcome modal, script tag)
- Modify: `js/editor.js:2220` (init call)
- Modify: `css/editor.css` (public dialog styles)

**Interfaces:**
- Consumes: `loadPublicConfig()` from Task 1.
- Produces: global `Welcome` with `init()`, `open()`, `close()`. In `tests/browser/public-mode.cjs`: helpers `config`, `isShown(page, id)`, `configLoaded(page)`, `reloaded(page)`, `openPublic()`, and a final `done()` that later tasks insert sections before. CSS classes `.public-dialog`, `.public-steps`.

- [ ] **Step 1: Write `data/public.json`**

This is starter wording; Glenn edits it. Keep `printHelp` exactly as written, since Tasks 4 and 5 check against this file.

```json
{
  "wordsEmail": "workshop@gsr.mozmail.com",
  "welcome": {
    "heading": "Make a zine with Ephemera Eternal",
    "paragraphs": [
      "Ephemera Eternal is a zine workshop about gentrification and the places it pushes out: venues, flyers, neighborhoods. Its material comes from local news coverage, archival show flyers, documentary photographs, and lines written by people who came before you.",
      "You can make one here, on your own. Your zine stays in this browser; nothing you make is uploaded."
    ],
    "steps": [
      "Pick a format at the top: a half-letter booklet, a one-sheet zine, or a poster.",
      "Build your pages from the panels on the left: flyers, clip art, photos, and lines from the poetry generator. Type your own words anywhere.",
      "Add a word or line in the box under the generator. If you agree, it can go into the algorithm for other people's zines, and you can send it to Glenn when you save.",
      "On a booklet, fill in Your info so readers know who made it.",
      "Check it with Digital Preview, then Save as PDF and print. Save Project keeps a copy to come back to."
    ]
  },
  "printHelp": {
    "duplex": [
      "Print double-sided, flip on short edge.",
      "Print at 100% (\"actual size\"), not \"fit to page\".",
      "Fold the stack in half, nest the sheets in order, and staple the spine."
    ],
    "two-pass": [
      "Print the first half of the pages.",
      "Put the printed stack back in the tray. Which way depends on your printer, so try one sheet first.",
      "Print the second half.",
      "Fold the stack in half, nest the sheets in order, and staple the spine."
    ],
    "sheet": [
      "Print at 100% (\"actual size\"), not \"fit to page\".",
      "Fold or staple as your format needs."
    ],
    "poster": [
      "Print at 100% (\"actual size\") on paper that matches the poster: letter or legal."
    ]
  }
}
```

- [ ] **Step 2: Write the failing browser check** `tests/browser/public-mode.cjs`

```js
// public-mode.cjs — the public version (the plain URL): the welcome, the Print & fold dialog, and
// offering consented words at Save as PDF, and that none of it appears with ?workshop.
'use strict';

const fs = require('fs');
const { open, assert, done } = require('./harness.cjs');
const config = require('../../data/public.json');

const isShown = (page, id) => page.$eval('#' + id, el => el.classList.contains('show'));
// Waits until data/public.json is in, so a modal that should have opened by now has
const configLoaded = async page => { await page.evaluate(() => loadPublicConfig()); await page.waitForTimeout(100); };
async function reloaded(page) {
    await page.reload();
    await page.waitForFunction(() => typeof Autosave !== 'undefined' && Autosave.enabled);
    await configLoaded(page);
}
// The public version with the first-visit welcome already dismissed
async function openPublic() {
    const session = await open(undefined, '');
    await session.page.waitForSelector('#welcome-modal.show');
    await session.page.click('#welcome-start-btn');
    return session;
}

(async () => {
    console.log('[public: welcome on the first visit]');
    let session = await open(undefined, '');
    let page = session.page;
    await page.waitForSelector('#welcome-modal.show');
    assert('heading from data/public.json', (await page.textContent('#welcome-title')) === config.welcome.heading);
    assert('one paragraph per entry', (await page.$$eval('#welcome-paragraphs p', ps => ps.length)) === config.welcome.paragraphs.length);
    assert('numbered steps from data/public.json', JSON.stringify(await page.$$eval('#welcome-steps li', lis => lis.map(li => li.textContent))) ===
        JSON.stringify(config.welcome.steps));
    assert('How to button shown', !(await page.$eval('#how-to-btn', b => b.hidden)));
    await page.click('#welcome-start-btn');
    assert('Start closes it', !(await isShown(page, 'welcome-modal')));
    await reloaded(page);
    assert('not shown again on the next visit', !(await isShown(page, 'welcome-modal')));
    await page.click('#new-zine-btn');   // the harness accepts the confirm
    await page.waitForTimeout(200);
    assert('New does not bring it back', !(await isShown(page, 'welcome-modal')));
    await page.click('#how-to-btn');
    assert('How to reopens it', await isShown(page, 'welcome-modal'));
    await page.keyboard.press('Escape');
    assert('Escape closes it', !(await isShown(page, 'welcome-modal')));
    assert('focus goes back to How to', await page.evaluate(() => document.activeElement.id === 'how-to-btn'));
    await session.close();

    console.log('[public: storage blocked]');
    session = await open(undefined, '');
    page = session.page;
    await page.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
    });
    await reloaded(page);
    assert('welcome shows', await isShown(page, 'welcome-modal'));
    await page.click('#welcome-start-btn');
    assert('Start still closes it', !(await isShown(page, 'welcome-modal')));
    await reloaded(page);
    assert('and it shows again next visit', await isShown(page, 'welcome-modal'));
    await session.close();

    console.log('[public: data/public.json missing]');
    session = await open(undefined, '');
    page = session.page;
    await page.route('**/data/public.json', route => route.fulfill({ status: 404, body: '' }));
    await reloaded(page);
    assert('no welcome', !(await isShown(page, 'welcome-modal')));
    assert('no How to', await page.$eval('#how-to-btn', b => b.hidden));
    assert('the editor still works', await page.evaluate(() => state.pages.length > 0 && !!document.querySelector('.page-tab')));
    await session.close();

    console.log('[workshop: no welcome]');
    session = await open();   // the harness opens ?workshop by default
    page = session.page;
    await configLoaded(page);
    assert('no welcome with ?workshop', !(await isShown(page, 'welcome-modal')));
    assert('no How to with ?workshop', await page.$eval('#how-to-btn', b => b.hidden));
    await session.close();

    done();
})();
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `NODE_PATH=/home/user/.cache/ephemera-eternal-tools/node_modules node tests/browser/public-mode.cjs`
Expected: times out waiting for `#welcome-modal.show`.

- [ ] **Step 4: Add the markup.** In `index.html`, make this the first child of `<div class="export-buttons">`:

```html
                <button class="btn btn-tertiary" id="how-to-btn" title="What this is and how to make a zine" hidden>How to</button>
```

After the word-review modal (before the `<script>` tags), add:

```html
    <!-- Public version: welcome (first visit; How to reopens it) -->
    <div class="preview-modal" id="welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <div class="booklet-export-dialog public-dialog">
            <h2 id="welcome-title"></h2>
            <div id="welcome-paragraphs"></div>
            <ol class="public-steps" id="welcome-steps"></ol>
            <button class="btn" id="welcome-start-btn">Start</button>
        </div>
    </div>
```

Add `<script src="js/welcome.js"></script>` after `js/infoform.js`.

- [ ] **Step 5: Write `js/welcome.js`**

```js
// welcome.js — the public version's welcome: what the project is and how to make a zine, from
// data/public.json. It opens over the editor on the first visit, and How to in the top bar reopens
// it. Not shown with ?workshop, where a facilitator explains.

const WELCOME_SEEN_KEY = 'ee-welcome-seen';

const Welcome = {
    returnFocus: null,   // what had focus when How to opened it

    init: async function () {
        const config = await loadPublicConfig();
        const welcome = config && config.welcome;
        if (!welcome || typeof welcome.heading !== 'string') return;
        Welcome.fill(welcome);
        const modal = document.getElementById('welcome-modal');
        const howTo = document.getElementById('how-to-btn');
        howTo.hidden = false;
        howTo.addEventListener('click', Welcome.open);
        document.getElementById('welcome-start-btn').addEventListener('click', Welcome.close);
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && modal.classList.contains('show')) Welcome.close();
        });
        if (!Welcome.seen()) Welcome.open();
    },

    fill: function (welcome) {
        const strings = list => (Array.isArray(list) ? list.filter(s => typeof s === 'string') : []);
        document.getElementById('welcome-title').textContent = welcome.heading;
        const paragraphs = document.getElementById('welcome-paragraphs');
        strings(welcome.paragraphs).forEach(text => {
            const p = document.createElement('p');
            p.className = 'booklet-export-note';
            p.textContent = text;
            paragraphs.appendChild(p);
        });
        const steps = document.getElementById('welcome-steps');
        strings(welcome.steps).forEach(text => {
            const li = document.createElement('li');
            li.textContent = text;
            steps.appendChild(li);
        });
    },

    // Blocked storage counts as not seen: the welcome just shows again next visit
    seen: function () {
        try {
            return localStorage.getItem(WELCOME_SEEN_KEY) === '1';
        } catch (e) {
            return false;
        }
    },

    open: function () {
        Welcome.returnFocus = document.activeElement;
        document.getElementById('welcome-modal').classList.add('show');
        document.getElementById('welcome-start-btn').focus();
    },

    close: function () {
        document.getElementById('welcome-modal').classList.remove('show');
        try { localStorage.setItem(WELCOME_SEEN_KEY, '1'); } catch (e) { /* shows again next visit */ }
        const back = Welcome.returnFocus;
        Welcome.returnFocus = null;
        if (back && back !== document.body && back.focus) back.focus();
        else document.getElementById('welcome-start-btn').blur();   // keys go back to the editor
    }
};
```

- [ ] **Step 6: Start it.** In `js/editor.js`, after `    WordReview.init();` add:

```js
    Welcome.init();
```

- [ ] **Step 7: Styles.** Append to `css/editor.css` after the `.word-review-when` block:

```css
/* Public version: welcome, Print & fold, sending words */
.public-dialog {
    max-width: 520px;
    margin-top: 10vh;
    max-height: 80vh;
    overflow-y: auto;
}

.public-steps {
    margin: 0 0 12px;
    padding-left: 20px;
    font-size: 13px;
    line-height: 1.5;
    color: #333;
}

.public-steps li + li {
    margin-top: 4px;
}
```

- [ ] **Step 8: Run the check**

Run: `NODE_PATH=/home/user/.cache/ephemera-eternal-tools/node_modules node tests/browser/public-mode.cjs`
Expected: `N passed, 0 failed`.

- [ ] **Step 9: Commit**

```bash
git add data/public.json js/welcome.js tests/browser/public-mode.cjs index.html js/editor.js css/editor.css
git commit -m "Public version: first-visit welcome and How to

Wording and the words address live in data/public.json.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Print & fold after the PDF saves

**Files:**
- Create: `js/printhelp.js`
- Modify: `index.html` (modal, script tag)
- Modify: `js/export.js` (`generatePDF`)
- Modify: `js/editor.js` (init call)
- Test: `tests/browser/public-mode.cjs`

**Interfaces:**
- Consumes: `loadPublicConfig()`, `Mode.workshop`; `public-mode.cjs` helpers from Task 3.
- Produces: global `PrintHelp` with `init()`, `show(kind: 'duplex'|'two-pass'|'sheet'|'poster')`, `close()`. In `public-mode.cjs`: helpers `stubPdf(page)`, `savedPdfs(page)`, `saveAs(page, bookletMode)`, defined at the top of the file.

- [ ] **Step 1: Write the failing checks.** In `tests/browser/public-mode.cjs`, add after the `openPublic` function:

```js
// Swaps the PDF builders for stand-ins that only record the file name, so a save is instant
const stubPdf = page => page.evaluate(() => {
    window.savedPdfs = [];
    const fake = async () => ({ save: name => window.savedPdfs.push(name) });
    window.buildBookletPdf = fake;
    window.buildSheetPdf = fake;
});
const savedPdfs = page => page.evaluate(() => window.savedPdfs.length);
// Presses Save as PDF; bookletMode is what the booklet question answers ('duplex', 'two-pass', or null for Cancel)
async function saveAs(page, bookletMode) {
    await page.evaluate(m => { window.chooseBookletMode = async () => m; }, bookletMode);
    await page.click('#print-btn');
}
```

Insert before the final `    done();`:

```js
    console.log('[public: Print & fold after the PDF saves]');
    session = await openPublic();
    page = session.page;
    await stubPdf(page);
    const helpSteps = () => page.$$eval('#print-help-steps li', lis => lis.map(li => li.textContent));
    assert('double-sided steps say flip on short edge', config.printHelp.duplex.join(' ').includes('flip on short edge'));
    for (const [format, mode, kind] of [
        ['half-letter', 'duplex', 'duplex'], ['half-letter', 'two-pass', 'two-pass'],
        ['single-page', null, 'sheet'], ['stapled', null, 'sheet'],
        ['poster-letter', null, 'poster'], ['poster-legal', null, 'poster']
    ]) {
        await page.selectOption('#page-format', format);
        await saveAs(page, mode);
        await page.waitForSelector('#print-help-modal.show');
        assert(`${format}${mode ? ' ' + mode : ''}: the ${kind} steps`, JSON.stringify(await helpSteps()) === JSON.stringify(config.printHelp[kind]));
        await page.click('#print-help-done-btn');
        assert('Done closes it', !(await isShown(page, 'print-help-modal')));
    }
    const before = await savedPdfs(page);
    await page.selectOption('#page-format', 'half-letter');
    await saveAs(page, null);
    await page.waitForTimeout(300);
    assert('cancelled booklet: no PDF, no dialog', (await savedPdfs(page)) === before && !(await isShown(page, 'print-help-modal')));
    await page.selectOption('#page-format', 'single-page');
    await page.evaluate(() => { window.buildSheetPdf = async () => { throw new Error('test failure'); }; });
    await Promise.all([page.waitForEvent('dialog'), saveAs(page, null)]);   // the harness accepts the failure alert
    await page.waitForFunction(() => !document.getElementById('print-btn').disabled);
    assert('failed save: no dialog', !(await isShown(page, 'print-help-modal')));
    await stubPdf(page);
    await saveAs(page, null);
    await page.waitForSelector('#print-help-modal.show');
    await page.keyboard.press('Escape');
    assert('Escape closes it', !(await isShown(page, 'print-help-modal')));
    await session.close();

    console.log('[workshop: no Print & fold]');
    session = await open();
    page = session.page;
    await stubPdf(page);
    await page.selectOption('#page-format', 'single-page');
    await saveAs(page, null);
    await page.waitForFunction(() => window.savedPdfs.length === 1);
    await page.waitForTimeout(200);
    assert('PDF saved with no dialog', !(await isShown(page, 'print-help-modal')));
    await session.close();
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `NODE_PATH=/home/user/.cache/ephemera-eternal-tools/node_modules node tests/browser/public-mode.cjs`
Expected: the Task 3 sections pass, then it times out waiting for `#print-help-modal.show`.

- [ ] **Step 3: Markup.** In `index.html`, after the welcome modal:

```html
    <!-- Public version: how to print and fold, after the PDF saves -->
    <div class="preview-modal" id="print-help-modal" role="dialog" aria-modal="true" aria-labelledby="print-help-title">
        <div class="booklet-export-dialog public-dialog">
            <h2 id="print-help-title">Print &amp; fold</h2>
            <ol class="public-steps" id="print-help-steps"></ol>
            <button class="btn" id="print-help-done-btn">Done</button>
        </div>
    </div>
```

Add `<script src="js/printhelp.js"></script>` after `js/welcome.js`.

- [ ] **Step 4: Write `js/printhelp.js`**

```js
// printhelp.js — the public version's Print & fold steps, shown once a PDF has saved, for people
// printing at home without a facilitator. The steps for each kind of PDF ('duplex', 'two-pass',
// 'sheet', 'poster') are in data/public.json under printHelp.

const PrintHelp = {
    steps: null,

    init: async function () {
        const config = await loadPublicConfig();
        if (!config || !config.printHelp || typeof config.printHelp !== 'object') return;
        PrintHelp.steps = config.printHelp;
        const modal = document.getElementById('print-help-modal');
        document.getElementById('print-help-done-btn').addEventListener('click', PrintHelp.close);
        modal.addEventListener('click', e => { if (e.target === modal) PrintHelp.close(); });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && modal.classList.contains('show')) PrintHelp.close();
        });
    },

    show: function (kind) {
        const steps = PrintHelp.steps && PrintHelp.steps[kind];
        if (!Array.isArray(steps) || steps.length === 0) return;
        const list = document.getElementById('print-help-steps');
        list.innerHTML = '';
        steps.filter(s => typeof s === 'string').forEach(text => {
            const li = document.createElement('li');
            li.textContent = text;
            list.appendChild(li);
        });
        document.getElementById('print-help-modal').classList.add('show');
        document.getElementById('print-help-done-btn').focus();
    },

    close: function () {
        document.getElementById('print-help-modal').classList.remove('show');
    }
};
```

- [ ] **Step 5: Hook it in.** In `js/export.js` `generatePDF()`, inside `try`, after the `if (isBooklet) { … } else { … }` save block (still inside `try`, so a failure skips it):

```js
        if (!Mode.workshop) PrintHelp.show(isBooklet ? mode : state.pageFormat.startsWith('poster') ? 'poster' : 'sheet');
```

In `js/editor.js`, after `    Welcome.init();` add `    PrintHelp.init();`.

- [ ] **Step 6: Run the check**

Run: `NODE_PATH=/home/user/.cache/ephemera-eternal-tools/node_modules node tests/browser/public-mode.cjs`
Expected: `N passed, 0 failed`.

- [ ] **Step 7: Commit**

```bash
git add js/printhelp.js index.html js/export.js js/editor.js tests/browser/public-mode.cjs
git commit -m "Public version: Print & fold steps after the PDF saves

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Offer the words at Save as PDF

**Files:**
- Create: `js/wordssend.js`
- Modify: `index.html` (modal, script tag)
- Modify: `js/export.js` (`generatePDF`)
- Modify: `js/editor.js` (init call)
- Modify: `css/editor.css`
- Test: `tests/browser/public-mode.cjs`

**Interfaces:**
- Consumes: `loadPublicConfig()`, `Mode.workshop` (Task 1); `markWordSent`, `wordsTextFile`, `wordsTextFileName`, `wordsMailto` (Task 2); `WordStore.all()`, `WordStore.put(entry)`; `stubPdf`, `savedPdfs`, `saveAs` (Task 4).
- Produces: global `WordsSend` with `init()`, `offer() → Promise<void>` (resolves once the person has chosen, or straight away when there's nothing to offer), `close()`.

- [ ] **Step 1: Write the failing checks.** In `tests/browser/public-mode.cjs`, insert before the final `    done();`:

```js
    console.log('[public: offering the words at Save as PDF]');
    session = await openPublic();
    page = session.page;
    await stubPdf(page);
    const addWords = async text => {
        await page.fill('#word-entry', text);
        await page.click('#word-entry-add-btn');
        await page.click('#word-consent-yes-btn');
    };
    const statuses = () => page.evaluate(async () => (await WordStore.all()).map(e => e.status));
    // Waits for the n-th saved PDF and closes the Print & fold dialog that follows it
    const finishSave = async n => {
        await page.waitForFunction(count => window.savedPdfs.length === count, n);
        await page.waitForSelector('#print-help-modal.show');
        await page.click('#print-help-done-btn');
    };
    const offerShown = () => page.waitForSelector('#words-send-modal.show');

    await page.selectOption('#page-format', 'single-page');
    await saveAs(page, null);
    await finishSave(1);
    assert('no words: the PDF saves without asking', true);

    await addWords('the corner store remembers');
    await addWords('rent is a\nfour-letter word');
    await page.waitForFunction(async () => (await WordStore.all()).length === 2);
    await saveAs(page, null);
    await offerShown();
    assert('asks before the PDF', (await savedPdfs(page)) === 1);
    assert('says how many', (await page.textContent('#words-send-title')) === 'You offered 2 words or lines to the algorithm. Send them to Glenn?');
    assert('lists them', JSON.stringify(await page.$$eval('#words-send-list li', lis => lis.map(li => li.textContent))) ===
        JSON.stringify(['the corner store remembers', 'rent is a\nfour-letter word']));
    const href = await page.$eval('#words-send-email-btn', a => a.getAttribute('href'));
    assert('email link to the address in data/public.json', href.startsWith(`mailto:${config.wordsEmail}?subject=Words%20for%20Ephemera%20Eternal&body=`));

    await page.click('#words-send-later-btn');
    await finishSave(2);
    assert('Not now: still pending', JSON.stringify(await statuses()) === '["pending","pending"]');
    await saveAs(page, null);
    await offerShown();
    await page.keyboard.press('Escape');
    await finishSave(3);
    await saveAs(page, null);
    await offerShown();
    await page.mouse.click(5, 5);
    await finishSave(4);
    assert('Escape and a click outside: still pending', JSON.stringify(await statuses()) === '["pending","pending"]');

    await saveAs(page, null);
    await offerShown();
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#words-send-download-btn')]);
    assert('file name my-words-YYYY-MM-DD.txt', /^my-words-\d{4}-\d{2}-\d{2}\.txt$/.test(download.suggestedFilename()));
    assert('file: header, then one entry per line', /^Words offered to Ephemera Eternal, \d{4}-\d{2}-\d{2}\n\nthe corner store remembers\nrent is a \/ four-letter word\n$/
        .test(fs.readFileSync(await download.path(), 'utf8')));
    await page.waitForSelector('#words-send-attach:not([hidden])');
    assert('says where to send it', (await page.textContent('#words-send-attach-note')) === `Attach this file to an email to ${config.wordsEmail}.`);
    assert('the PDF waits for Continue', (await savedPdfs(page)) === 4);
    assert('Download marks them sent', JSON.stringify(await statuses()) === '["sent","sent"]' &&
        await page.evaluate(async () => (await WordStore.all()).every(e => e.sentAt)));
    await page.click('#words-send-continue-btn');
    await finishSave(5);
    await saveAs(page, null);
    await finishSave(6);
    assert('sent words are not offered again', true);

    await addWords('a third line');
    await page.waitForFunction(async () => (await WordStore.all()).length === 3);
    await saveAs(page, null);
    await offerShown();
    assert('only the unsent word, in the singular', (await page.$$eval('#words-send-list li', lis => lis.length)) === 1 &&
        (await page.textContent('#words-send-title')).startsWith('You offered 1 word or line'));
    // No mail app in the test browser: keep the link from navigating
    await page.evaluate(() => document.getElementById('words-send-email-btn').addEventListener('click', e => e.preventDefault()));
    await page.click('#words-send-email-btn');
    await finishSave(7);
    assert('Open email marks it sent', JSON.stringify(await statuses()) === '["sent","sent","sent"]');

    await page.evaluate(async () => {
        for (let i = 0; i < 30; i++) await WordStore.add(`a long line of words, number ${i}, that goes on for a while`);
    });
    await saveAs(page, null);
    await offerShown();
    assert('too long for a link: no Open email', await page.$eval('#words-send-email-btn', a => a.hidden));
    assert('says to download and attach', !(await page.$eval('#words-send-too-long', p => p.hidden)));
    await page.click('#words-send-later-btn');
    await finishSave(8);

    await page.route('**/data/public.json', route => route.fulfill({
        contentType: 'application/json', body: JSON.stringify(Object.assign({}, config, { wordsEmail: '' }))
    }));
    await reloaded(page);
    await stubPdf(page);
    await page.selectOption('#page-format', 'single-page');
    await saveAs(page, null);
    await finishSave(1);
    assert('no address: pending words, but no offer', (await statuses()).includes('pending'));
    await session.close();

    console.log('[workshop: no offer]');
    session = await open();
    page = session.page;
    await stubPdf(page);
    await page.evaluate(() => WordStore.add('workshop words'));
    await page.selectOption('#page-format', 'single-page');
    await saveAs(page, null);
    await page.waitForFunction(() => window.savedPdfs.length === 1);
    assert('PDF saved without an offer', !(await isShown(page, 'words-send-modal')));
    await session.close();
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `NODE_PATH=/home/user/.cache/ephemera-eternal-tools/node_modules node tests/browser/public-mode.cjs`
Expected: earlier sections pass, then it times out waiting for `#words-send-modal.show`.

- [ ] **Step 3: Markup.** In `index.html`, after the print-help modal:

```html
    <!-- Public version: offer the consented words to Glenn before the PDF -->
    <div class="preview-modal" id="words-send-modal" role="dialog" aria-modal="true" aria-labelledby="words-send-title">
        <div class="booklet-export-dialog public-dialog">
            <h2 id="words-send-title"></h2>
            <ul class="words-send-list" id="words-send-list"></ul>
            <div class="words-send-step" id="words-send-choices">
                <button class="btn" id="words-send-download-btn">Download words (.txt)</button>
                <a class="btn" id="words-send-email-btn" href="#">Open email</a>
                <p class="booklet-export-note" id="words-send-too-long" hidden>Too many words for an email link. Download the file and attach it.</p>
                <button class="btn btn-tertiary" id="words-send-later-btn">Not now</button>
            </div>
            <div class="words-send-step" id="words-send-attach" hidden>
                <p class="booklet-export-note" id="words-send-attach-note"></p>
                <button class="btn" id="words-send-continue-btn">Continue</button>
            </div>
        </div>
    </div>
```

Add `<script src="js/wordssend.js"></script>` after `js/printhelp.js`.

- [ ] **Step 4: Styles.** Append to `css/editor.css` after the public dialog block:

```css
.words-send-list {
    max-height: 30vh;
    overflow-y: auto;
    margin: 0 0 12px;
    padding-left: 20px;
    font-size: 13px;
    white-space: pre-line;   /* a poem keeps its line breaks */
    overflow-wrap: anywhere;
}

.words-send-step {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.words-send-step[hidden],
#words-send-email-btn[hidden] {
    display: none;
}

a.btn {
    text-align: center;
    text-decoration: none;
}
```

- [ ] **Step 5: Write `js/wordssend.js`**

```js
// wordssend.js — the public version's way to get consented words to Glenn. At Save as PDF, if
// data/public.json has an address and this browser holds pending words, it offers them: download a
// .txt to attach to an email, or open an email draft. Either one marks the words sent (the page
// can't know whether the person actually sent them). Not now leaves them pending, offered again
// at the next save.

const WordsSend = {
    address: '',
    ready: Promise.resolve(),   // init's config load; offer() waits for it
    offered: [],                // the entries in the open offer
    finish: null,               // resolves the open offer

    init: function () {
        WordsSend.ready = WordsSend.setup();
    },

    setup: async function () {
        const config = await loadPublicConfig();
        const address = config && typeof config.wordsEmail === 'string' ? config.wordsEmail.trim() : '';
        if (!/^[^\s@]+@[^\s@]+$/.test(address)) return;   // no address yet: no send step
        WordsSend.address = address;
        const modal = document.getElementById('words-send-modal');
        document.getElementById('words-send-download-btn').addEventListener('click', WordsSend.download);
        document.getElementById('words-send-email-btn').addEventListener('click', WordsSend.email);
        document.getElementById('words-send-later-btn').addEventListener('click', WordsSend.close);
        document.getElementById('words-send-continue-btn').addEventListener('click', WordsSend.close);
        modal.addEventListener('click', e => { if (e.target === modal) WordsSend.close(); });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && modal.classList.contains('show')) WordsSend.close();
        });
    },

    offer: async function () {
        await WordsSend.ready;
        if (!WordsSend.address) return;
        let pending;
        try {
            pending = (await WordStore.all()).filter(e => e.status === 'pending');
        } catch (e) {
            return;   // storage blocked: nothing was kept to send
        }
        if (pending.length === 0) return;

        WordsSend.offered = pending;
        const n = pending.length;
        document.getElementById('words-send-title').textContent =
            `You offered ${n} ${n === 1 ? 'word or line' : 'words or lines'} to the algorithm. Send them to Glenn?`;
        const list = document.getElementById('words-send-list');
        list.innerHTML = '';
        pending.forEach(entry => {
            const li = document.createElement('li');
            li.textContent = entry.text;
            list.appendChild(li);
        });
        const mailto = wordsMailto(WordsSend.address, pending, new Date());
        const email = document.getElementById('words-send-email-btn');
        email.hidden = !mailto;
        email.href = mailto || '#';
        document.getElementById('words-send-too-long').hidden = !!mailto;
        document.getElementById('words-send-choices').hidden = false;
        document.getElementById('words-send-attach').hidden = true;
        document.getElementById('words-send-modal').classList.add('show');
        document.getElementById('words-send-download-btn').focus();
        return new Promise(resolve => { WordsSend.finish = resolve; });
    },

    markSent: async function () {
        const now = new Date();
        try {
            await Promise.all(WordsSend.offered.map(entry => WordStore.put(markWordSent(entry, now))));
        } catch (e) { /* storage failed: they stay pending and are offered again */ }
    },

    download: async function () {
        const now = new Date();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([wordsTextFile(WordsSend.offered, now)], { type: 'text/plain' }));
        link.download = wordsTextFileName(now);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        await WordsSend.markSent();
        document.getElementById('words-send-attach-note').textContent = `Attach this file to an email to ${WordsSend.address}.`;
        document.getElementById('words-send-choices').hidden = true;
        document.getElementById('words-send-attach').hidden = false;
        document.getElementById('words-send-continue-btn').focus();
    },

    // The link itself opens the email draft; this marks the words and goes on to the PDF
    email: async function () {
        await WordsSend.markSent();
        WordsSend.close();
    },

    close: function () {
        document.getElementById('words-send-modal').classList.remove('show');
        const finish = WordsSend.finish;
        WordsSend.finish = null;
        WordsSend.offered = [];
        if (finish) finish();
    }
};
```

- [ ] **Step 6: Hook it in.** In `js/export.js`, make this the first line of `generatePDF()`:

```js
    if (!Mode.workshop) await WordsSend.offer();
```

In `js/editor.js`, after `    PrintHelp.init();` add `    WordsSend.init();`.

- [ ] **Step 7: Run the check**

Run: `NODE_PATH=/home/user/.cache/ephemera-eternal-tools/node_modules node tests/browser/public-mode.cjs`
Expected: `N passed, 0 failed`.

- [ ] **Step 8: Commit**

```bash
git add js/wordssend.js index.html js/export.js js/editor.js css/editor.css tests/browser/public-mode.cjs
git commit -m "Public version: offer consented words to Glenn at Save as PDF

Download a .txt or open an email draft to workshop@gsr.mozmail.com.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `serve.py`, the workshop words server

**Files:**
- Create: `serve.py`
- Create: `serve_test.py`
- Modify: `js/tracery.test.js` (pending never referenced)
- Modify: `.gitignore`

**Interfaces:**
- Produces (Python): `dump_grammar(grammar: dict) → str`; `clean_text(text) → str | None`; `WordsFile(path)` with `.lists() → {'pending': [...], 'approved': [...]}` and `.change(action, text) → lists`; `make_server(root: str, port: int) → ThreadingHTTPServer`.
- Produces (HTTP): `GET /api/words` → `{"pending": [...], "approved": [...]}`. `POST /api/words`, `/api/words/approve`, `/api/words/reject` and `/api/words/unapprove` take `{"text": "..."}` and answer 200 `{"ok": true, "pending": [...], "approved": [...]}`. A refused add is 400 `{"error": "..."}`. An unknown POST path is 404.

- [ ] **Step 1: Write the failing test** `serve_test.py`

```python
"""serve_test.py — tests for serve.py, the workshop words server. Each test runs a real server on
a free port against a temporary copy of data/grammar.json.

Run: python3 serve_test.py
"""

import json
import os
import shutil
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

import serve

ROOT = os.path.dirname(os.path.abspath(__file__))
GRAMMAR = os.path.join(ROOT, 'data', 'grammar.json')


def read_raw(path):
    with open(path, encoding='utf-8', newline='') as f:
        return f.read()


class LayoutTest(unittest.TestCase):
    def test_round_trip_is_byte_for_byte(self):
        raw = read_raw(GRAMMAR)
        self.assertEqual(serve.dump_grammar(json.loads(raw)), raw)


class ServerTest(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()
        os.mkdir(os.path.join(self.root, 'data'))
        self.path = os.path.join(self.root, 'data', 'grammar.json')
        shutil.copy(GRAMMAR, self.path)
        with open(os.path.join(self.root, 'index.html'), 'w', encoding='utf-8') as f:
            f.write('<p>zine</p>')
        self.server = serve.make_server(self.root, 0)
        self.port = self.server.server_address[1]
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        shutil.rmtree(self.root)

    def call(self, path, body=None, raw_body=None):
        data = raw_body if raw_body is not None else (None if body is None else json.dumps(body).encode())
        req = urllib.request.Request('http://127.0.0.1:%d%s' % (self.port, path), data=data,
                                     method='GET' if data is None else 'POST',
                                     headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b'null')

    def add(self, text):
        return self.call('/api/words', {'text': text})

    def grammar(self):
        return json.loads(read_raw(self.path))

    def test_binds_to_localhost_only(self):
        self.assertEqual(self.server.server_address[0], '127.0.0.1')

    def test_serves_the_folder(self):
        with urllib.request.urlopen('http://127.0.0.1:%d/index.html' % self.port) as r:
            self.assertEqual(r.read(), b'<p>zine</p>')

    def test_lists_start_empty_and_reading_writes_nothing(self):
        before = read_raw(self.path)
        self.assertEqual(self.call('/api/words'), (200, {'pending': [], 'approved': []}))
        self.assertEqual(read_raw(self.path), before)

    def test_add_trims_and_holds_back(self):
        origin = self.grammar()['origin']
        status, body = self.add('  the corner store remembers  ')
        self.assertEqual(status, 200)
        self.assertEqual(body['pending'], ['the corner store remembers'])
        g = self.grammar()
        self.assertEqual(g['participant_pending'], ['the corner store remembers'])
        self.assertEqual(g['participant'], [])
        self.assertEqual(g['origin'], origin)
        self.assertEqual(list(g)[-2:], ['participant', 'participant_pending'])

    def test_written_file_keeps_the_layout(self):
        self.add('café ✊ "quoted"\nsecond line')
        raw = read_raw(self.path)
        self.assertEqual(serve.dump_grammar(json.loads(raw)), raw)
        self.assertIn('café ✊', raw)
        self.assertFalse(raw.endswith('\n'))

    def test_duplicates_succeed_without_adding(self):
        self.add('same line')
        self.assertEqual(self.add('same line')[0], 200)
        self.call('/api/words/approve', {'text': 'same line'})
        self.assertEqual(self.add(' same line ')[0], 200)
        g = self.grammar()
        self.assertEqual((g['participant_pending'], g['participant']), ([], ['same line']))

    def test_refuses_empty_too_long_and_malformed(self):
        before = read_raw(self.path)
        for body in ({'text': '   '}, {'text': 'x' * 501}, {'text': 42}, {}, ['text']):
            self.assertEqual(self.call('/api/words', body)[0], 400, body)
        self.assertEqual(self.call('/api/words', raw_body=b'{not json')[0], 400)
        self.assertEqual(read_raw(self.path), before)
        self.assertEqual(self.add('x' * 500)[0], 200)

    def test_tracery_markup_becomes_look_alikes(self):
        self.add('#saveLou #nowhere [sic]')
        self.assertEqual(self.grammar()['participant_pending'], ['＃saveLou ＃nowhere ［sic］'])

    def test_approve_reject_unapprove(self):
        for text in ('one', 'two', 'three'):
            self.add(text)
        self.call('/api/words/approve', {'text': 'one'})
        self.call('/api/words/reject', {'text': 'two'})
        g = self.grammar()
        self.assertEqual((g['participant_pending'], g['participant']), (['three'], ['one']))
        self.assertEqual(g['origin'].count('#participant#'), 1)
        self.call('/api/words/approve', {'text': 'three'})
        self.assertEqual(self.grammar()['origin'].count('#participant#'), 1)
        status, body = self.call('/api/words/unapprove', {'text': 'one'})
        self.assertEqual((status, body['pending'], body['approved']), (200, ['one'], ['three']))

    def test_hand_repeated_reference_is_kept(self):
        self.add('one')
        self.call('/api/words/approve', {'text': 'one'})
        g = self.grammar()
        g['origin'].append('#participant#')
        with open(self.path, 'w', encoding='utf-8') as f:
            f.write(serve.dump_grammar(g))
        self.add('two')
        self.call('/api/words/approve', {'text': 'two'})
        self.assertEqual(self.grammar()['origin'].count('#participant#'), 2)

    def test_last_unapprove_drops_the_reference(self):
        self.add('only')
        self.call('/api/words/approve', {'text': 'only'})
        self.call('/api/words/unapprove', {'text': 'only'})
        g = self.grammar()
        self.assertEqual(g['participant'], [])
        self.assertNotIn('#participant#', g['origin'])

    def test_actions_on_missing_lines_change_nothing(self):
        self.add('here')
        before = read_raw(self.path)
        for action in ('approve', 'reject', 'unapprove'):
            self.assertEqual(self.call('/api/words/' + action, {'text': 'not here'})[0], 200)
        self.assertEqual(read_raw(self.path), before)

    def test_unknown_post_is_404(self):
        self.assertEqual(self.call('/api/nope', {'text': 'x'})[0], 404)

    def test_concurrent_adds_all_land(self):
        threads = [threading.Thread(target=self.add, args=('line %d' % i,)) for i in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(sorted(self.grammar()['participant_pending']), sorted('line %d' % i for i in range(20)))
        self.assertEqual([n for n in os.listdir(os.path.join(self.root, 'data')) if n.endswith('.tmp')], [])


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `python3 serve_test.py`
Expected: `ModuleNotFoundError: No module named 'serve'`.

- [ ] **Step 3: Write `serve.py`**

```python
#!/usr/bin/env python3
"""serve.py — the workshop computers' local server.

Serves this folder like `python3 -m http.server`, on 127.0.0.1 only, and adds a small JSON API
that writes participants' consented words into data/grammar.json:

    GET  /api/words              {"pending": [...], "approved": [...]}
    POST /api/words              {"text": "..."}  adds the line to participant_pending
    POST /api/words/approve      {"text": "..."}  participant_pending -> participant
    POST /api/words/reject       {"text": "..."}  removes it from participant_pending
    POST /api/words/unapprove    {"text": "..."}  participant -> participant_pending

No rule references participant_pending, so the generator never uses a line until Glenn approves
it. origin references participant once, from the first approval on. Glenn can repeat it by hand
to raise the share, and the server never adds a second one.

Run: python3 serve.py [port]    (default 8000), then open http://localhost:8000/?workshop
"""

import functools
import json
import os
import sys
import tempfile
import threading
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PENDING = 'participant_pending'
APPROVED = 'participant'
REFERENCE = '#participant#'
MAX_TEXT = 500
MAX_BODY = 16 * 1024
ACTIONS = {'/api/words': 'add', '/api/words/approve': 'approve',
           '/api/words/reject': 'reject', '/api/words/unapprove': 'unapprove'}
# Tracery reads # and [ ] as markup; look-alikes let a participant's line print as typed
MARKUP = str.maketrans({'#': '＃', '[': '［', ']': '］'})


def dump_grammar(grammar):
    """grammar.json's own layout: one symbol per line, a blank line between symbols."""
    lines = ['  %s: %s' % (json.dumps(key, ensure_ascii=False), json.dumps(value, ensure_ascii=False))
             for key, value in grammar.items()]
    return '{\n' + ',\n\n'.join(lines) + '\n}'


def clean_text(text):
    """The line as it will be stored, or None when it can't be added."""
    if not isinstance(text, str):
        return None
    text = text.strip().translate(MARKUP)
    if not text or len(text) > MAX_TEXT:
        return None
    return text


class WordsFile:
    """The participant symbols in data/grammar.json. Each change reads the file fresh, so Glenn's
    hand edits between requests are kept, and writes it whole, one change at a time."""

    def __init__(self, path):
        self.path = path
        self.lock = threading.Lock()

    def read(self):
        with open(self.path, encoding='utf-8') as f:
            return json.load(f)

    def lists(self, grammar=None):
        g = grammar if grammar is not None else self.read()
        return {'pending': list(g.get(PENDING, [])), 'approved': list(g.get(APPROVED, []))}

    def change(self, action, text):
        """Applies 'add', 'approve', 'reject' or 'unapprove' to text and returns the lists. A
        duplicate add, or a line that isn't where the action expects it, changes nothing."""
        with self.lock:
            g = self.read()
            before = dump_grammar(g)
            if APPROVED not in g:
                g[APPROVED] = []
            if PENDING not in g:
                g[PENDING] = []
            pending, approved = g[PENDING], g[APPROVED]
            if action == 'add' and text not in pending and text not in approved:
                pending.append(text)
            elif action == 'approve' and text in pending:
                pending.remove(text)
                approved.append(text)
            elif action == 'reject' and text in pending:
                pending.remove(text)
            elif action == 'unapprove' and text in approved:
                approved.remove(text)
                pending.append(text)
            origin = g.setdefault('origin', [])
            if approved and REFERENCE not in origin:
                origin.append(REFERENCE)
            elif not approved and REFERENCE in origin:
                # nothing left to expand: a bare reference would print "[participant]"
                g['origin'] = [rule for rule in origin if rule != REFERENCE]
            after = dump_grammar(g)
            if after != before or action == 'add':
                self.write(after)
            return self.lists(g)

    def write(self, text):
        folder = os.path.dirname(self.path)
        fd, tmp = tempfile.mkstemp(dir=folder, prefix='.grammar-', suffix='.tmp')
        try:
            with os.fdopen(fd, 'w', encoding='utf-8', newline='') as f:
                f.write(text)
            os.chmod(tmp, os.stat(self.path).st_mode & 0o777)
            os.replace(tmp, self.path)
        except BaseException:
            if os.path.exists(tmp):
                os.unlink(tmp)
            raise


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, words, **kwargs):
        self.words = words   # set before the base class handles the request
        super().__init__(*args, **kwargs)

    def route(self):
        return self.path.split('?', 1)[0]

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.route() == '/api/words':
            return self.send_json(HTTPStatus.OK, self.words.lists())
        return super().do_GET()

    def do_POST(self):
        action = ACTIONS.get(self.route())
        if not action:
            return self.send_json(HTTPStatus.NOT_FOUND, {'error': 'Not found'})
        try:
            length = int(self.headers.get('Content-Length') or 0)
            if length > MAX_BODY:
                raise ValueError('body too large')
            body = json.loads(self.rfile.read(length) or b'null')
        except ValueError:
            return self.send_json(HTTPStatus.BAD_REQUEST, {'error': 'Expected {"text": "..."}'})
        text = body.get('text') if isinstance(body, dict) else None
        if action == 'add':
            text = clean_text(text)
            if text is None:
                return self.send_json(HTTPStatus.BAD_REQUEST,
                                      {'error': 'Empty, or longer than %d characters' % MAX_TEXT})
        elif not isinstance(text, str):
            return self.send_json(HTTPStatus.BAD_REQUEST, {'error': 'Expected {"text": "..."}'})
        try:
            lists = self.words.change(action, text)
        except (OSError, ValueError) as e:
            return self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {'error': str(e)})
        self.send_json(HTTPStatus.OK, dict(ok=True, **lists))


def make_server(root, port=8000):
    words = WordsFile(os.path.join(root, 'data', 'grammar.json'))
    handler = functools.partial(Handler, directory=root, words=words)
    return ThreadingHTTPServer(('127.0.0.1', port), handler)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = make_server(os.path.dirname(os.path.abspath(__file__)), port)
    print('Workshop: http://localhost:%d/?workshop   (Ctrl+C to stop)' % port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
```

`json.JSONDecodeError` and `int()` failures are both `ValueError`, so the one `except` covers bad JSON and a bad `Content-Length`. Adds always write, even duplicates: the first add creates `participant` and `participant_pending` if they're missing, and a rewrite of an unchanged file is byte-identical.

- [ ] **Step 4: Run the test**

Run: `python3 serve_test.py`
Expected: `OK` (15 tests).

- [ ] **Step 5: Guard the grammar in the Node test.** In `js/tracery.test.js`, insert before the `console.log('\n──…` results line:

```js
console.log('\n[participant_pending is never expanded]');
var mentions = Object.keys(grammar).filter(function (symbol) {
    return grammar[symbol].some(function (rule) { return rule.indexOf('participant_pending') >= 0; });
});
assert('no rule mentions participant_pending' + (mentions.length ? ' — found in ' + mentions.join(', ') : ''), mentions.length === 0);
```

Run: `node js/tracery.test.js`
Expected: `Results: N passed, 0 failed`.

- [ ] **Step 6: Ignore leftover temp files.** Append to `.gitignore`:

```
# serve.py's temp file, if a write is ever interrupted
data/.grammar-*.tmp
```

- [ ] **Step 7: Commit**

```bash
git add serve.py serve_test.py js/tracery.test.js .gitignore
git commit -m "serve.py: workshop server that writes consented words into grammar.json

Pending lines sit in participant_pending, which no rule references, until
Glenn approves them into participant.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Workshop client uses the words server

**Files:**
- Modify: `js/wordentry.js`
- Modify: `js/wordreview.js`
- Modify: `js/generator.js`
- Modify: `index.html` (review source note)
- Create: `tests/browser/workshop-words.cjs`
- Modify: `tests/browser/word-consent.cjs` (notice wait)

**Interfaces:**
- Consumes: `Mode.workshop` (Task 1); the HTTP API from Task 6 (relative URLs `api/words`, `api/words/<action>`).
- Produces: `WordEntry.sendToServer(text) → Promise<bool>`; `WordReview.serverLists() → Promise<{pending, approved}|null>`; `WordReview.fill(listId, items, actions)` with items `{ key, text, when?, entry? }`.

- [ ] **Step 1: Write the failing browser check** `tests/browser/workshop-words.cjs`

```js
// workshop-words.cjs — workshop computers with serve.py: a Yes goes into data/grammar.json through
// the words API, the review works on the server's lists, and without the server everything falls
// back to this browser's storage. The API is faked with page.route; serve_test.py tests serve.py.
'use strict';

const { open, assert, done } = require('./harness.cjs');
const TEST_PHRASE = 'test-only passphrase';

// A stand-in for serve.py's words API, keeping its lists in memory
async function fakeServer(page, words = { pending: [], approved: [] }) {
    const calls = [];
    await page.route('**/api/words**', route => {
        const req = route.request();
        const action = new URL(req.url()).pathname.split('/api/words')[1].replace('/', '') || (req.method() === 'POST' ? 'add' : 'list');
        const text = req.method() === 'POST' ? JSON.parse(req.postData()).text : null;
        calls.push(action);
        if (action === 'add' && text.trim().length > 500) {
            return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Empty, or longer than 500 characters' }) });
        }
        const move = (from, to) => {
            if (!words[from].includes(text)) return;
            words[from] = words[from].filter(t => t !== text);
            if (to) words[to].push(text);
        };
        if (action === 'add' && !words.pending.includes(text.trim())) words.pending.push(text.trim());
        if (action === 'approve') move('pending', 'approved');
        if (action === 'reject') move('pending', null);
        if (action === 'unapprove') move('approved', 'pending');
        route.fulfill({ contentType: 'application/json', body: JSON.stringify(Object.assign({ ok: true }, words)) });
    });
    return { words, calls };
}

(async () => {
    console.log('[workshop with the server: Yes goes to grammar.json]');
    let session = await open();
    let page = session.page;
    let server = await fakeServer(page);
    const consent = async (text, answer = '#word-consent-yes-btn') => {
        await page.fill('#word-entry', text);
        await page.click('#word-entry-add-btn');
        await page.click(answer);
        await page.waitForTimeout(200);
    };
    const local = () => page.evaluate(async () => (await WordStore.all()).map(e => e.text));
    const notice = () => page.evaluate(() => { const n = document.getElementById('save-notice'); return n ? n.textContent : ''; });
    await consent('the corner store remembers');
    assert('sent to the server as pending', JSON.stringify(server.words.pending) === '["the corner store remembers"]');
    assert('not kept in this browser', (await local()).length === 0);
    assert('no notice', (await notice()) === '');
    await consent('keep this to myself', '#word-consent-no-btn');
    assert('no consent: nothing sent', server.calls.filter(c => c === 'add').length === 1);
    await consent('x'.repeat(501));
    assert('too long: says so', (await notice()).includes('500 characters'));
    assert('too long: not kept anywhere', server.words.pending.length === 1 && (await local()).length === 0);
    assert('the words stay on the page', await page.evaluate(() => getCurrentPage().elements.some(e => e.content === 'x'.repeat(501))));

    console.log('[the generator never offers pending lines]');
    const symbols = await page.evaluate(() => {
        state.grammar.participant = ['an approved line'];
        state.grammar.participant_pending = ['not reviewed yet'];
        Generator.renderSymbolOptions();
        return [...document.querySelectorAll('#generator-symbol-select option')].map(o => o.value);
    });
    assert('participant_pending is not in the symbol list', !symbols.includes('participant_pending'));
    assert('participant is', symbols.includes('participant'));
    await session.close();

    console.log('[workshop without the server: this computer only]');
    session = await open();
    page = session.page;
    await consent('first words');
    assert('kept in this browser, pending', JSON.stringify(await page.evaluate(async () => (await WordStore.all()).map(e => `${e.status}:${e.text}`))) ===
        '["pending:first words"]');
    assert('says so', (await notice()).includes('Words saved on this computer only.'));
    await page.evaluate(() => document.getElementById('save-notice').remove());
    await consent('second words');
    assert('says it once per visit', (await notice()) === '');
    assert('both kept', (await local()).length === 2);
    await session.close();

    console.log('[public: Yes never calls the server]');
    session = await open(undefined, '');
    page = session.page;
    await page.waitForSelector('#welcome-modal.show');
    await page.click('#welcome-start-btn');
    server = await fakeServer(page);
    await consent('public words');
    assert('no API call', server.calls.length === 0);
    assert('kept in this browser', JSON.stringify(await local()) === '["public words"]');
    await session.close();

    console.log('[review against the server]');
    session = await open(undefined, '?workshop&organizer');
    page = session.page;
    server = await fakeServer(page, { pending: ['first line', 'second line'], approved: ['old line'] });
    await page.evaluate(async phrase => { WordReview.passHash = await sha256Hex(phrase); }, TEST_PHRASE);
    await page.click('#word-review-btn');
    await page.fill('#word-review-pass', TEST_PHRASE);
    await page.click('#word-review-lock button[type="submit"]');
    await page.waitForFunction(() => !document.getElementById('word-review-body').hidden);
    const items = id => page.$$eval(`#${id} li[data-id]`, lis => lis.map(li => li.querySelector('.word-review-text').textContent));
    const act = async (listId, text, action) => {
        await page.evaluate(({ listId, text, action }) => {
            const li = [...document.querySelectorAll(`#${listId} li[data-id]`)].find(l => l.querySelector('.word-review-text').textContent === text);
            li.querySelector(`button[data-action="${action}"]`).click();
        }, { listId, text, action });
        await page.waitForTimeout(200);
    };
    assert('lists the server\'s lines', JSON.stringify(await items('word-review-pending')) === '["first line","second line"]' &&
        JSON.stringify(await items('word-review-approved')) === '["old line"]');
    assert('no download or clear with the server', await page.$eval('#word-review-download-btn', b => b.hidden) &&
        await page.$eval('#word-review-clear-btn', b => b.hidden));
    assert('says the lines are in data/grammar.json', (await page.textContent('#word-review-source')).includes('data/grammar.json'));
    await act('word-review-pending', 'first line', 'approve');
    await act('word-review-pending', 'second line', 'reject');
    await act('word-review-approved', 'old line', 'undo');
    assert('approve, reject and undo reach the server', JSON.stringify(server.words) === '{"pending":["old line"],"approved":["first line"]}');
    assert('and the lists follow', JSON.stringify(await items('word-review-pending')) === '["old line"]' &&
        JSON.stringify(await items('word-review-approved')) === '["first line"]');
    await session.close();

    done();
})();
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `NODE_PATH=/home/user/.cache/ephemera-eternal-tools/node_modules node tests/browser/workshop-words.cjs`
Expected: FAIL on `sent to the server as pending`, among others.

- [ ] **Step 3: `js/wordentry.js`.** Update the header's last sentence to: "Consent stores them as pending for Glenn's review: at a workshop running serve.py, straight into data/grammar.json; otherwise in this browser (wordstore.js). No, Escape or clicking away stores nothing." Add a field `    warnedLocal: false,   // "this computer only" is said once per visit` under `waiting`. Replace the `try` block in `answer` and add `sendToServer`:

```js
        try {
            if (Mode.workshop && await WordEntry.sendToServer(text)) return;
            await WordStore.add(text);
        } catch (e) {
            Autosave.showNotice("Couldn't save on this computer; your words stay on your page.");
        }
    },

    // serve.py puts the words in data/grammar.json, pending Glenn's review. True when the server
    // dealt with them (took them, or refused them with a notice); false when there's no server,
    // e.g. plain http.server or ?workshop on the live site, and the words go to this browser.
    sendToServer: async function (text) {
        let response = null;
        try {
            response = await fetch('api/words', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text })
            });
        } catch (e) { /* no server */ }
        if (response && response.ok) return true;
        if (response && response.status === 400) {
            const refusal = await response.json().catch(() => null);
            if (refusal && refusal.error) {
                Autosave.showNotice('Those words are too long for the algorithm (500 characters at most). They stay on your page.');
                return true;
            }
        }
        if (!WordEntry.warnedLocal) {
            WordEntry.warnedLocal = true;
            Autosave.showNotice('Words saved on this computer only.');
        }
        return false;
    }
```

(The `},` that closed `answer` is now the one before `sendToServer`; the object's closing `};` stays.)

- [ ] **Step 4: `index.html`.** In the word-review modal, make this the first child of `#word-review-body`:

```html
                <p class="booklet-export-note" id="word-review-source"></p>
```

- [ ] **Step 5: `js/wordreview.js`.** Replace the header comment with:

```js
// wordreview.js — Glenn's review of participants' consented words, shown only with
// ?workshop&organizer. A passphrase keeps curious participants out. Only its SHA-256 digest is in
// this file and the check runs in the page, so it deters rather than secures. With serve.py
// running, the review works on data/grammar.json directly: approved lines reach the generator
// after a reload. Without it, the words are this browser's, and approved ones are downloaded as a
// file and merged into data/grammar.json by hand.
```

Replace the whole `render` method with these four methods:

```js
    // serve.py's pending and approved lines, or null when it isn't running
    serverLists: async function () {
        try {
            const response = await fetch('api/words', { cache: 'no-store' });
            const lists = response.ok ? await response.json() : null;
            return lists && Array.isArray(lists.pending) && Array.isArray(lists.approved) ? lists : null;
        } catch (e) {
            return null;
        }
    },

    render: async function () {
        const lists = await WordReview.serverLists();
        document.getElementById('word-review-download-btn').hidden = !!lists;
        document.getElementById('word-review-clear-btn').hidden = !!lists;
        document.getElementById('word-review-source').textContent = lists
            ? 'These lines are in data/grammar.json. Approved ones reach the generator after a reload.'
            : 'These words are kept in this browser only.';
        if (lists) {
            const post = (action, item) => fetch(`api/words/${action}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: item.text })
            }).then(r => { if (!r.ok) throw new Error(`words server: ${r.status}`); });
            const items = list => list.map((text, i) => ({ key: `server-${i}`, text }));
            WordReview.fill('word-review-pending', items(lists.pending), [
                ['Approve', item => post('approve', item)],
                ['Reject', item => post('reject', item)]
            ]);
            WordReview.fill('word-review-approved', items(lists.approved), [
                ['Undo', item => post('unapprove', item)]
            ]);
            return;
        }
        const entries = await WordStore.all();
        const items = status => entries.filter(e => e.status === status)
            .map(e => ({ key: e.id, text: e.text, when: new Date(e.addedAt).toLocaleString(), entry: e }));
        WordReview.fill('word-review-pending', items('pending'), [
            ['Approve', item => WordStore.put(approveWordEntry(item.entry, new Date()))],
            ['Reject', item => WordStore.remove(item.entry.id)]   // gone for good: "will not appear again"
        ]);
        WordReview.fill('word-review-approved', items('approved'), [
            ['Undo', item => WordStore.put(unapproveWordEntry(item.entry))]
        ]);
    },

    // One list; items are { key, text, when? }, actions are [label, run(item)]
    fill: function (listId, items, actions) {
        const list = document.getElementById(listId);
        list.innerHTML = '';
        if (items.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'word-review-empty';
            empty.textContent = 'None';
            list.appendChild(empty);
        }
        items.forEach(item => {
            const li = document.createElement('li');
            li.dataset.id = item.key;
            const text = document.createElement('span');
            text.className = 'word-review-text';
            text.textContent = item.text;
            li.appendChild(text);
            if (item.when) {
                const when = document.createElement('span');
                when.className = 'word-review-when';
                when.textContent = item.when;
                li.appendChild(when);
            }
            actions.forEach(([label, run]) => {
                const b = document.createElement('button');
                b.className = 'btn btn-tertiary';
                b.textContent = label;
                b.dataset.action = label.toLowerCase();
                b.addEventListener('click', async () => {
                    try {
                        await run(item);
                    } catch (e) {
                        Autosave.showNotice("Couldn't save that change; try again.");
                    }
                    await WordReview.render();
                });
                li.appendChild(b);
            });
            list.appendChild(li);
        });
    },
```

- [ ] **Step 6: `js/generator.js`.** Make the fetch revalidate, so approved lines show after a reload:

```js
        fetch('data/grammar.json', { cache: 'no-cache' })   // approved participant lines show on reload
```

In `renderSymbolOptions`, skip the held-back symbol:

```js
        // participant_pending holds unreviewed words: never offered (serve.py, data/grammar.json)
        Object.keys(state.grammar).filter(symbol => symbol !== 'participant_pending').forEach(symbol => {
```

- [ ] **Step 7: `tests/browser/word-consent.cjs`.** With `?workshop` and no server, the first Yes now shows "Words saved on this computer only.", so wait for the right notice. Replace:

```js
    await page.waitForSelector('#save-notice');
```

with:

```js
    await page.waitForFunction(() => { const n = document.getElementById('save-notice'); return n && n.textContent.includes("Couldn't save"); });
```

- [ ] **Step 8: Run the checks**

Run:
```bash
for f in workshop-words word-consent word-review public-mode; do NODE_PATH=/home/user/.cache/ephemera-eternal-tools/node_modules node tests/browser/$f.cjs | tail -1; done
```
Expected: each prints `N passed, 0 failed`.

- [ ] **Step 9: Commit**

```bash
git add js/wordentry.js js/wordreview.js js/generator.js index.html tests/browser/workshop-words.cjs tests/browser/word-consent.cjs
git commit -m "Workshop: consented words and review go through serve.py when it runs

Falls back to this browser's storage without it. The generator never lists
participant_pending.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: README and the full run

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Opening night URL.** In `### Opening-night back cover`, replace `` `http://localhost:8000/?opening-night` `` with `` `http://localhost:8000/?workshop&opening-night` ``, and "comes back when the tool is opened without `?opening-night`" with "comes back when the tool is opened without it". In `### Randomize`, replace "In `?opening-night` mode" with "In opening-night mode".

- [ ] **Step 2: Replace the `### Participant words and review` section** (from its heading to just before `## Posters`) with:

```markdown
### Participant words and review

**Add a word or line…** puts the words on the participant's current page, then asks "May the
algorithm reuse your words?" (denying means the words will not appear again). Where consented
words go depends on the version:

- **Workshop with `serve.py`** (see Running locally): straight into `data/grammar.json` as
  `participant_pending`, which no rule uses. Open `?workshop&organizer` for **Review words**
  (passphrase required, remembered until the browser closes; only its SHA-256 hash is in the
  code). **Approve** moves a line into `participant`, which `origin` references once (repeat
  `"#participant#"` in `origin` by hand to raise its share). **Reject** deletes it, and **Undo** sends it back to
  pending. Approved lines reach the generator and Randomize after a **reload**, so reload after
  **New** between participants. A participant's `#`, `[` and `]` are stored as look-alikes
  (`＃［］`) so the line prints as typed. **Review before you commit:** `participant_pending` is
  in the repo, so committing first publishes those lines as unused data.
- **Workshop without the server** (plain `http.server`): the words stay in that browser's
  storage, apart from the zine (they survive **New**), and the participant sees "Words saved on
  this computer only." **Review words** then works on that browser's list: approve, reject or
  undo, **Download approved** (`approved-words-YYYY-MM-DD.json`) and, once the file is safe,
  **Clear downloaded**. Merge approved words into `data/grammar.json` by hand.
- **Public version:** the words stay in the person's browser. At **Save as PDF** they're offered
  to Glenn (see Public version).
```

- [ ] **Step 3: Add a `## Public version` section** right before `## Posters`:

```markdown
## Public version

The plain URL (`https://glennritchey.net/ephemera-eternal/`) is for people making a zine at
home, with no facilitator. The in-person workshop is `?workshop`. `?opening-night` and
`?organizer` only work together with it (`?workshop&opening-night`, `?workshop&organizer`); on
their own they do nothing. **Before the next workshop, update the workshop computers' bookmarks
to `http://localhost:8000/?workshop`.**

The public version adds three things, all worded in `data/public.json`:

- **Welcome** (`welcome`: `heading`, `paragraphs`, `steps`): shown over the editor on the first
  visit; **How to** in the top bar reopens it.
- **Sending words** (`wordsEmail`): at **Save as PDF**, if the person consented to any words that
  haven't been sent, they're offered **Download words (.txt)** (`my-words-YYYY-MM-DD.txt`, to
  attach to an email), **Open email** (a draft to `wordsEmail`, when the words fit in a link), or
  **Not now** (offered again at the next save). Either of the first two marks the words sent. The
  page can't tell whether the person actually sent them. With `wordsEmail` empty there's no send
  step.
- **Print & fold** (`printHelp`: `duplex`, `two-pass`, `sheet`, `poster`, one list of steps
  each): shown after the PDF saves. Keep "flip on short edge" in the double-sided steps.

If `data/public.json` is missing or broken, none of these appear; the editor still works.
```

- [ ] **Step 4: Replace the `## Running locally` section** body (keep the heading) with:

````markdown
No build step. Serve the folder over HTTP (opening `index.html` directly via `file://` will not
load the grammar or gallery).

At a workshop, use the words server, which also writes consented words into
`data/grammar.json`:

```bash
python3 serve.py          # or: python3 serve.py 8001
```

Then open `http://localhost:8000/?workshop`. It only listens on this computer. For anything
else, any static server works:

```bash
python3 -m http.server
```

Tests: `node js/<name>.test.js` for each Node test, `python3 serve_test.py` for the server, and
the browser checks below.
````

- [ ] **Step 5: File layout.** In `## File layout`, add these lines after the `js/infoform.js` line:

```markdown
- `js/mode.js` — `?workshop` and its flags; loads `data/public.json` for the public version
- `js/welcome.js`, `js/printhelp.js`, `js/wordssend.js` — the public version's welcome, Print & fold steps, and sending words (`data/public.json`)
- `serve.py` — the workshop's local server and words API (`serve_test.py`)
```

and change the `js/wordreview.js` line to:

```markdown
- `js/wordreview.js` — `?workshop&organizer` review (through `serve.py` when it runs), passphrase, approved-words download
```

- [ ] **Step 6: Run everything**

```bash
for f in js/*.test.js; do node "$f" > /dev/null && echo "ok   $f" || echo "FAIL $f"; done
python3 serve_test.py
for f in tests/browser/*.cjs; do [ "$f" = tests/browser/harness.cjs ] && continue; printf '%s: ' "$f"; NODE_PATH=/home/user/.cache/ephemera-eternal-tools/node_modules node "$f" | tail -1; done
```
Expected: every Node test `ok`, `serve_test.py` `OK`, every browser check `N passed, 0 failed`. A check that stalls for several seconds on a click is likely a notice covering a toolbar button. Fix the check (wait for or remove `#save-notice`) rather than the app.

- [ ] **Step 7: Smoke-test the real server by hand**

```bash
python3 serve.py 8765 &
sleep 1
curl -s -X POST localhost:8765/api/words -H 'Content-Type: application/json' -d '{"text":"smoke test"}'
curl -s localhost:8765/api/words
kill %1
git diff --stat data/grammar.json   # expect a change: participant and participant_pending added
git checkout data/grammar.json
```
Expected: the POST answers `{"ok": true, "pending": ["smoke test"], "approved": []}`, and after `git checkout` the file matches the committed one again.

- [ ] **Step 8: Commit**

```bash
git add README.md
git commit -m "README: public version, ?workshop bookmarks, serve.py and the words review

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
