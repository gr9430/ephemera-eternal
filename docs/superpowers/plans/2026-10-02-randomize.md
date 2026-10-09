# Randomize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Randomize button that, after a confirm dialog, fills a half-letter booklet with 24 inside pages plus covers of random layouts (grammar lines, clip art, Adam Goldman's photos — never flyers), then shows the IBM dialog and lands on Your info.

**Architecture:** One new file `js/randomize.js` holds a pure composer (`composeZine` and helpers, no DOM, Node-tested like `js/booklet.js`) and a small `Randomize` UI object that wires the toolbar button and two modals. Pages come out in the editor's existing page/element shape, so editor, preview, PDF, autosave and Save Project need no changes.

**Tech Stack:** Plain browser JS (no build), Node for unit tests (`node js/<name>.test.js`), Playwright + headless Chromium for browser checks (`tests/browser/*.cjs`).

**Spec:** `docs/superpowers/specs/2026-10-02-randomize-design.md`

## Global Constraints

- Never use flyers: no element `src` from `data/gallery.json` or `images/flyers/`. Images only from `data/clipart.json` and `data/photos.json`.
- Confirm dialog text, verbatim: `are you sure you want to forego all creativity to an algorithm?` plus the smaller line `Your current zine will be replaced.` Buttons `Yes` / `No`.
- IBM dialog: image `images/clipart/ibm.png`, text verbatim: `this image is correct: insert your information, please.` One button `OK`.
- Front cover title text is always `Ephemera Eternal`; the random output is the subtitle.
- Page is 528 × 816 canvas px with 48 px margins; text color `#1a1a1a`; paper `#f8f8f0`.
- Text under 36 px uses readable fonts only (editor categories Core, Sans Serif, Serif, plus `Liberation Mono`); Display / Experimental / Special fonts only for the title and slogans.
- Opening-night mode (`OpeningNight.active`): the back-cover page object is carried over untouched. Glenn's info page is never touched.
- Your info (`their-info`) page is emptied and `state.meta.info` reset to `{}`.
- **Do not commit.** Glenn commits himself; the commit steps below are replaced by "leave uncommitted".
- Test tooling: `S=/tmp/claude-1000/-home-user-repos-ephemera-eternal/bf80e3fb-cb7a-41f7-aaa1-d49199ceef7f/scratchpad` has Playwright in `$S/node_modules`; run browser checks with `CHROME_PATH=$(ls ~/.cache/ms-playwright/chromium_headless_shell-1223/*/chrome-headless-shell) NODE_PATH=$S/node_modules node tests/browser/<name>.cjs` from the repo root `~/Documents/repos/ephemera-eternal`.

## Review Focus

1. Data not loaded yet (empty `state.photoImages` / `state.clipartImages`, grammar still `{ origin: [] }`) when Randomize is clicked — expect a zine with the title and whatever content exists, no crash, no `[origin]`-style placeholder text. Pinned in Task 1 (empty pools, empty lines) and Task 2 (`Randomize.line` returns `''` for a missing symbol).
2. More draws than a pool holds (clip art can need >49 pieces across 25 pages) — expect no repeat until every piece of that pool has been used once. Pinned in Task 1 ("no repeat before the pool is used up").
3. Randomizing a single-page zine whose view was rotated — expect half-letter, view rotation back to 0, format `<select>` showing half-letter. Pinned in Task 2.
4. Reload after randomizing — expect autosave to bring back the randomized 27-page zine. Pinned in Task 2.
5. Escape / backdrop on either dialog — confirm acts as No (nothing changes), IBM dialog acts as OK (goes to Your info). Pinned in Task 2.

---

### Task 1: Pure composer (`composeZine`) with Node tests

**Files:**
- Create: `js/randomize.js` (composer part only in this task)
- Test: `js/randomize.test.js`

**Interfaces:**
- Consumes: nothing from other tasks. Data files `data/clipart.json`, `data/photos.json`, `data/gallery.json` (arrays of `{ id, src, alt, ... }`).
- Produces (all global in the browser, exported in Node):
  - `composeZine({ line, clipart, photos, fonts, rng, newId, insidePages })` → `Array<{ id, role, layout?, elements }>` with roles `front-cover`, `their-info`, `insidePages` × `inside`, `back-cover`. `line(symbol: string) → string` (may return `''`); `fonts = { readable: string[], display: string[] }`; `rng() → [0,1)`; `newId() → unique id`. Composed pages carry `layout` (one of `'front-cover'` or `RANDOM_LAYOUTS`); the UI strips it.
  - `randomFontLists(sources: Array<{family, category}>, available: Object<family, label>) → { readable, display }`
  - `RANDOM_LAYOUTS = ['big-image', 'poem', 'collage', 'photo-slogan']`, `RANDOM_TITLE = 'Ephemera Eternal'`, `RANDOM_GRIT`, `rotatedSize(w, h, deg) → { w, h }`

- [ ] **Step 1: Write the failing tests**

Create `js/randomize.test.js`:

```js
/**
 * randomize.test.js — Node.js test for the pure composer in randomize.js.
 * No DOM required. A seeded random source makes every failure replayable.
 */

'use strict';

const R = require('./randomize.js');
const clipart = require('../data/clipart.json');
const photos = require('../data/photos.json');
const gallery = require('../data/gallery.json');

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}

// mulberry32: small seeded generator, returns [0, 1)
function seeded(seed) {
    return function () {
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

const fonts = { readable: ['Liberation Mono', 'Inter-Regular', 'Libre-Baskerville'], display: ['Anthony', 'Avara-Black'] };
const SEEDS = [1, 2, 3, 42, 2026];
const BLEED = ['background-image', 'texture'];

function compose(seed, extra) {
    let id = 0, n = 0;
    return R.composeZine(Object.assign({
        line: symbol => `${symbol} line ${++n}`,
        clipart, photos, fonts,
        rng: seeded(seed),
        newId: () => ++id,
        insidePages: 24
    }, extra || {}));
}

const all = (pages, fn) => pages.every(p => p.elements.every(e => fn(e, p)));
const srcs = pages => pages.flatMap(p => p.elements.filter(e => e.type === 'image' || e.type === 'background-image').map(e => e.src));

console.log('[structure]');
for (const seed of SEEDS) {
    const pages = compose(seed);
    const roles = pages.map(p => p.role);
    assert(`seed ${seed}: front cover, Your info, 24 inside, back cover`,
        roles.length === 27 && roles[0] === 'front-cover' && roles[1] === 'their-info' &&
        roles.slice(2, 26).every(r => r === 'inside') && roles[26] === 'back-cover');
    assert(`seed ${seed}: Your info is empty`, pages[1].elements.length === 0);
    const ids = pages.flatMap(p => [p.id, ...p.elements.map(e => e.id)]);
    assert(`seed ${seed}: page and element ids are unique`, new Set(ids).size === ids.length);
}

console.log('[sources]');
{
    const flyerSrcs = new Set(gallery.map(g => g.src));
    const allowed = new Set([...clipart, ...photos].map(i => i.src));
    for (const seed of SEEDS) {
        const used = srcs(compose(seed));
        assert(`seed ${seed}: no flyers`, used.every(s => !flyerSrcs.has(s) && !s.startsWith('images/flyers/')));
        assert(`seed ${seed}: images only from clip art and photos`, used.every(s => allowed.has(s)));
    }
}

console.log('[no repeat before the pool is used up]');
{
    const check = (used, pool) => {
        const poolSrcs = new Set(pool.map(i => i.src));
        let seen = new Set();
        for (const s of used.filter(u => poolSrcs.has(u))) {
            if (seen.size === poolSrcs.size) seen = new Set();
            if (seen.has(s)) return false;
            seen.add(s);
        }
        return true;
    };
    for (const seed of SEEDS) {
        const used = srcs(compose(seed));
        assert(`seed ${seed}: photos`, check(used, photos));
        assert(`seed ${seed}: clip art`, check(used, clipart));
    }
    const small = clipart.slice(0, 3);
    const used = srcs(compose(7, { clipart: small, photos: [] }));
    assert('tiny pool: reuses only after all 3 pieces used', check(used, small) && used.length > 3);
}

console.log('[layouts]');
{
    const seen = new Set();
    for (const seed of SEEDS) {
        const pages = compose(seed);
        assert(`seed ${seed}: front cover uses the front-cover layout`, pages[0].layout === 'front-cover');
        const rest = pages.slice(2);
        assert(`seed ${seed}: every inside page and the back cover has a known layout`, rest.every(p => R.RANDOM_LAYOUTS.includes(p.layout)));
        assert(`seed ${seed}: no layout twice in a row`, rest.every((p, i) => i === 0 || p.layout !== rest[i - 1].layout));
        rest.forEach(p => seen.add(p.layout));
    }
    assert('all four layouts show up', R.RANDOM_LAYOUTS.every(l => seen.has(l)));
}

console.log('[margins]');
for (const seed of SEEDS) {
    const inside = all(compose(seed), e => {
        if (BLEED.includes(e.type)) return true;
        const box = R.rotatedSize(e.w, e.h, e.rotation);
        const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
        return cx - box.w / 2 >= 47.5 && cx + box.w / 2 <= 480.5 && cy - box.h / 2 >= 47.5 && cy + box.h / 2 <= 768.5;
    });
    assert(`seed ${seed}: every non-bleed element sits inside the margins`, inside);
}

console.log('[text]');
for (const seed of SEEDS) {
    const pages = compose(seed);
    assert(`seed ${seed}: text under 36px uses readable fonts`, all(pages, e => e.type !== 'text' || e.fontSize >= 36 || fonts.readable.includes(e.font)));
    assert(`seed ${seed}: text 36px and up uses display fonts`, all(pages, e => e.type !== 'text' || e.fontSize < 36 || fonts.display.includes(e.font)));
    assert(`seed ${seed}: text is near-black`, all(pages, e => e.type !== 'text' || e.color === '#1a1a1a'));
    const front = pages[0].elements.filter(e => e.type === 'text');
    assert(`seed ${seed}: front cover title is Ephemera Eternal in a display font`,
        front.length >= 2 && front[0].content === R.RANDOM_TITLE && fonts.display.includes(front[0].font));
    assert(`seed ${seed}: front cover subtitle is random output`, /^(slogan|origin) line \d+$/.test(front[1].content));
    assert(`seed ${seed}: photo + slogan pages use slogans`, pages.filter(p => p.layout === 'photo-slogan')
        .every(p => p.elements.filter(e => e.type === 'text').every(e => e.content.startsWith('slogan'))));
}

console.log('[grit]');
{
    const pages = SEEDS.flatMap(seed => compose(seed));
    const gritty = pages.filter(p => p.elements.some(e => e.type === 'texture'));
    assert('some pages get grit, most do not', gritty.length > 0 && gritty.length < pages.length / 2);
    assert('grit is a top-layer overlay from overlays/', gritty.every(p => {
        const last = p.elements[p.elements.length - 1];
        return last.type === 'texture' && R.RANDOM_GRIT.includes(last.src) && last.opacity === 0.3 && last.blendMode === 'multiply';
    }));
}

console.log('[missing data]');
{
    const noImages = compose(5, { clipart: [], photos: [] });
    assert('no clip art or photos: still 27 pages, no image elements', noImages.length === 27 &&
        all(noImages, e => e.type !== 'image' && e.type !== 'background-image'));
    const noText = compose(5, { line: () => '' });
    assert('empty grammar: no empty text elements', all(noText, e => e.type !== 'text' || e.content.length > 0));
    assert('empty grammar: title still there', noText[0].elements.some(e => e.content === R.RANDOM_TITLE));
    assert('empty grammar: no paper strip without a slogan', all(noText, e => e.type !== 'background'));
}

console.log('[repeatable]');
assert('same seed gives the same zine', JSON.stringify(compose(9)) === JSON.stringify(compose(9)));
assert('different seeds give different zines', JSON.stringify(compose(9)) !== JSON.stringify(compose(10)));

console.log('[randomFontLists]');
{
    const sources = [
        { family: 'Inter-Regular', category: 'Core' },
        { family: 'Work-Sans', category: 'Sans Serif' },
        { family: 'Libre-Baskerville', category: 'Serif' },
        { family: 'Anthony', category: 'Display' },
        { family: 'Mess', category: 'Experimental' },
        { family: 'Facade-Est', category: 'Special' }
    ];
    const available = { 'Liberation Mono': 'Liberation Mono', 'Inter-Regular': 'x', 'Libre-Baskerville': 'x', 'Anthony': 'x', 'Facade-Est': 'x' };
    const lists = R.randomFontLists(sources, available);
    assert('readable: Liberation Mono + loaded Core/Sans/Serif', lists.readable.join() === 'Liberation Mono,Inter-Regular,Libre-Baskerville');
    assert('display: loaded Display/Experimental/Special', lists.display.join() === 'Anthony,Facade-Est');
    const none = R.randomFontLists(sources, { 'Liberation Mono': 'Liberation Mono' });
    assert('no display fonts loaded: falls back to readable', none.display.join() === 'Liberation Mono');
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node js/randomize.test.js`
Expected: FAIL with `Cannot find module './randomize.js'`.

- [ ] **Step 3: Write the composer**

Create `js/randomize.js`:

```js
// randomize.js — "forego all creativity to an algorithm": fills a half-letter booklet with
// random layouts of grammar lines, clip art and Adam Goldman's photos (never flyers).
// composeZine and its helpers are pure (no DOM) and Node-tested in randomize.test.js;
// the Randomize object below wires the toolbar button and the two dialogs.

const RANDOM_PAGE = { w: 528, h: 816, margin: 48 };
const RANDOM_INK = '#1a1a1a';
const RANDOM_PAPER = '#f8f8f0';
const RANDOM_LAYOUTS = ['big-image', 'poem', 'collage', 'photo-slogan'];
const RANDOM_GRIT = ['overlays/grit-1.png', 'overlays/grit-2.png'];
const RANDOM_TITLE = 'Ephemera Eternal';
const READABLE_CATEGORIES = ['Core', 'Sans Serif', 'Serif'];
const DISPLAY_CATEGORIES = ['Display', 'Experimental', 'Special'];

function randomTools(rng) {
    return {
        rng,
        int: (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1)),
        float: (lo, hi) => lo + rng() * (hi - lo),
        pick: list => list[Math.floor(rng() * list.length)],
        shuffle: list => {
            const a = list.slice();
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(rng() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        }
    };
}

// Hands out items without repeats; reshuffles only once every item has been used
function makePool(items, r) {
    let queue = [];
    return () => {
        if (!items || items.length === 0) return null;
        if (queue.length === 0) queue = r.shuffle(items);
        return queue.pop();
    };
}

// Axis-aligned size of a w × h box rotated by deg
function rotatedSize(w, h, deg) {
    const a = Math.abs(deg || 0) * Math.PI / 180;
    return { w: w * Math.cos(a) + h * Math.sin(a), h: w * Math.sin(a) + h * Math.cos(a) };
}

// Moves (and if it can't fit, shrinks) an element so its rotated box sits inside the margins
function keepInside(el) {
    const { w: pw, h: ph, margin: m } = RANDOM_PAGE;
    let box = rotatedSize(el.w, el.h, el.rotation);
    const scale = Math.min(1, (pw - 2 * m) / box.w, (ph - 2 * m) / box.h);
    if (scale < 1) {
        el.w = Math.floor(el.w * scale);
        el.h = Math.floor(el.h * scale);
        box = rotatedSize(el.w, el.h, el.rotation);
    }
    const cx = Math.min(Math.max(el.x + el.w / 2, m + box.w / 2), pw - m - box.w / 2);
    const cy = Math.min(Math.max(el.y + el.h / 2, m + box.h / 2), ph - m - box.h / 2);
    el.x = cx - el.w / 2;
    el.y = cy - el.h / 2;
    return el;
}

// Generous height estimate for wrapped text (characters average ~0.62em wide)
function textHeight(content, fontSize, w) {
    const perLine = Math.max(1, Math.floor((w - 8) / (fontSize * 0.62)));
    const lines = Math.max(1, Math.ceil(content.length / perLine));
    return Math.ceil(lines * fontSize * 1.2 + 8);
}

function randomText(newId, o) {
    return keepInside({
        id: newId(), type: 'text', x: o.x, y: o.y, w: o.w, h: textHeight(o.content, o.fontSize, o.w),
        rotation: o.rotation || 0, content: o.content, font: o.font, fontSize: o.fontSize,
        color: RANDOM_INK, bold: false, italic: false, align: o.align || 'left'
    });
}

function randomImage(newId, item, x, y, w, h, rotation) {
    return keepInside({ id: newId(), type: 'image', x, y, w, h, rotation, src: item.src, alt: item.alt || '', filter: 'none' });
}

const repeat = (value, n) => Array.from({ length: n }, () => value);

// Each layout takes the composing context c and returns a page's elements, bottom layer first
const RANDOM_LAYOUT_BUILDERS = {
    'big-image': c => {
        const els = [];
        const photo = c.nextPhoto();
        if (photo) els.push(randomImage(c.newId, photo, 48, 48, 432, 480, c.r.float(-2, 2)));
        const caption = c.line('origin');
        if (caption) {
            els.push(randomText(c.newId, {
                x: 54, y: photo ? 548 : 300, w: 420, content: caption,
                font: c.r.pick(c.fonts.readable), fontSize: c.r.int(14, 18), rotation: c.r.float(-2, 2)
            }));
        }
        return els;
    },

    'poem': c => {
        const els = [];
        const n = c.r.int(4, 7);
        const band = (RANDOM_PAGE.h - 2 * RANDOM_PAGE.margin) / n;
        for (let i = 0; i < n; i++) {
            const content = c.line('origin');
            if (!content) continue;
            const w = c.r.int(260, 400);
            els.push(randomText(c.newId, {
                x: 48 + c.r.float(0, 432 - w), y: 48 + i * band + c.r.float(0, band * 0.25), w, content,
                font: c.r.pick(c.fonts.readable), fontSize: c.r.int(14, 22), rotation: c.r.float(-4, 4)
            }));
        }
        return els;
    },

    // Cut-outs get double-height bands, lines single; a cut-out may spill a little past its band
    'collage': c => {
        const els = [];
        const kinds = c.r.shuffle([...repeat('clip', c.r.int(2, 3)), ...repeat('line', c.r.int(2, 3))]);
        const unit = (RANDOM_PAGE.h - 2 * RANDOM_PAGE.margin) / kinds.reduce((sum, k) => sum + (k === 'clip' ? 2 : 1), 0);
        let top = 48;
        kinds.forEach(kind => {
            const height = unit * (kind === 'clip' ? 2 : 1);
            if (kind === 'clip') {
                const piece = c.nextClip();
                if (piece) {
                    const size = Math.min(c.r.int(120, 260), Math.round(height * 1.2));
                    els.push(randomImage(c.newId, piece, 48 + c.r.float(0, 432 - size), top + (height - size) / 2, size, size, c.r.float(-15, 15)));
                }
            } else {
                const content = c.line('origin');
                if (content) {
                    const w = c.r.int(200, 360);
                    els.push(randomText(c.newId, {
                        x: 48 + c.r.float(0, 432 - w), y: top + c.r.float(0, height * 0.2), w, content,
                        font: c.r.pick(c.fonts.readable), fontSize: c.r.int(14, 20), rotation: c.r.float(-4, 4)
                    }));
                }
            }
            top += height;
        });
        return els;
    },

    // Full-page photo; the slogan sits on a solid paper strip so it stays readable
    'photo-slogan': c => {
        const els = [];
        const photo = c.nextPhoto();
        if (photo) {
            els.push({ id: c.newId(), type: 'background-image', x: 0, y: 0, w: 528, h: 816, rotation: 0, src: photo.src, alt: photo.alt || '', opacity: 1, blendMode: 'normal' });
        }
        const slogan = c.line('slogan');
        if (slogan) {
            const text = randomText(c.newId, {
                x: 64, y: c.r.float(200, 560), w: 400, content: slogan,
                font: c.r.pick(c.fonts.display), fontSize: c.r.int(36, 56), align: 'center'
            });
            els.push(keepInside({ id: c.newId(), type: 'background', x: 48, y: text.y - 12, w: 432, h: text.h + 24, rotation: 0, color: RANDOM_PAPER, opacity: 1 }));
            els.push(text);
        }
        return els;
    }
};

function composeFrontCover(c) {
    const els = [];
    const title = randomText(c.newId, {
        x: 59, y: 60, w: 410, content: RANDOM_TITLE,
        font: c.r.pick(c.fonts.display), fontSize: c.r.int(44, 64), rotation: c.r.float(-3, 3), align: 'center'
    });
    els.push(title);
    let bottom = title.y + title.h;
    const subtitle = c.line(c.r.rng() < 0.5 ? 'slogan' : 'origin');
    if (subtitle) {
        const sub = randomText(c.newId, {
            x: 48, y: bottom + 16, w: 432, content: subtitle,
            font: c.r.pick(c.fonts.readable), fontSize: c.r.int(18, 24), align: 'center'
        });
        els.push(sub);
        bottom = sub.y + sub.h;
    }
    const item = c.r.rng() < 0.5 ? (c.nextPhoto() || c.nextClip()) : (c.nextClip() || c.nextPhoto());
    if (item) {
        const y = bottom + 24;
        els.push(randomImage(c.newId, item, 48, y, 432, Math.max(120, 768 - y), c.r.float(-3, 3)));
    }
    return els;
}

// About one page in four gets a grit overlay on top
function maybeGrit(c, els) {
    if (c.r.rng() < 0.25) {
        els.push({ id: c.newId(), type: 'texture', x: 0, y: 0, w: 528, h: 816, rotation: 0, src: c.r.pick(RANDOM_GRIT), alt: 'grit overlay', blendMode: 'multiply', opacity: 0.3 });
    }
    return els;
}

function composeZine({ line, clipart, photos, fonts, rng, newId, insidePages }) {
    const r = randomTools(rng);
    const c = { r, newId, line, fonts, nextPhoto: makePool(photos, r), nextClip: makePool(clipart, r) };
    const pages = [
        { id: newId(), role: 'front-cover', layout: 'front-cover', elements: maybeGrit(c, composeFrontCover(c)) },
        { id: newId(), role: 'their-info', elements: [] }
    ];
    let previous = null;
    for (let i = 0; i <= insidePages; i++) {   // the extra pass is the back cover
        const layout = r.pick(RANDOM_LAYOUTS.filter(name => name !== previous));
        previous = layout;
        pages.push({ id: newId(), role: i < insidePages ? 'inside' : 'back-cover', layout, elements: maybeGrit(c, RANDOM_LAYOUT_BUILDERS[layout](c)) });
    }
    return pages;
}

// Splits the editor's loaded fonts into readable (small text) and display (title, slogans)
function randomFontLists(sources, available) {
    const loaded = categories => sources.filter(f => categories.includes(f.category) && f.family in available).map(f => f.family);
    const readable = ['Liberation Mono', ...loaded(READABLE_CATEGORIES)];
    const display = loaded(DISPLAY_CATEGORIES);
    return { readable, display: display.length ? display : readable };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { composeZine, randomFontLists, rotatedSize, RANDOM_LAYOUTS, RANDOM_TITLE, RANDOM_GRIT };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node js/randomize.test.js`
Expected: `Results: N passed, 0 failed` (exit 0). If a margins assertion fails, fix the layout's starting box (not the test); `keepInside` must leave every non-bleed element inside 48..480 × 48..768.

- [ ] **Step 5: Leave uncommitted** (Glenn commits himself). Run the other Node tests to be sure nothing else broke: `for t in js/*.test.js; do node $t | tail -1; done` — all `0 failed`.

---

### Task 2: Randomize button, dialogs, apply, browser check, README, PDF review

**Files:**
- Modify: `js/randomize.js` (append the `Randomize` UI object above the `module.exports` block)
- Modify: `index.html` (toolbar button after `#new-zine-btn`; two modals after `#booklet-export-modal`; script tag after `js/openingnight.js`)
- Modify: `js/editor.js` (`Randomize.init();` after `OpeningNight.init();` in the `DOMContentLoaded` handler at the end of the file)
- Modify: `css/editor.css` (IBM image rule after `.booklet-export-note`)
- Modify: `README.md` (section before `## Browser checks`; file-layout line)
- Test: `tests/browser/randomize.cjs`

**Interfaces:**
- Consumes from Task 1: `composeZine`, `randomFontLists`. From the app: `state`, `render()`, `generateId()`, `fontSources` (top-level `const` in `js/editor.js`), `Tracery.expand(grammar, symbol)`, `MAX_INSIDE_PAGES` (`js/booklet.js`), `OpeningNight.active`.
- Produces: `Randomize.init()`, `Randomize.apply()`, `Randomize.finish()`, `Randomize.line(symbol)`; DOM ids `randomize-btn`, `randomize-confirm-modal`, `randomize-yes-btn`, `randomize-no-btn`, `randomize-done-modal`, `randomize-ok-btn`.

- [ ] **Step 1: Write the failing browser check**

Create `tests/browser/randomize.cjs`:

```js
// randomize.cjs — the Randomize button: confirm dialog, the random 24-page booklet,
// the IBM dialog, autosave, and opening-night mode leaving the back cover alone.
'use strict';

const { open, assert, done } = require('./harness.cjs');

const shown = (page, id) => page.$eval('#' + id, el => el.classList.contains('show'));
const dataLoaded = page => page.waitForFunction(() =>
    state.photoImages.length && state.clipartImages.length && state.grammar.slogan && state.grammar.slogan.length);

(async () => {
    let session = await open();
    let page = session.page;
    await dataLoaded(page);

    console.log('[confirm dialog]');
    const before = await page.evaluate(() => JSON.stringify(state.pages));
    await page.click('#randomize-btn');
    assert('opens', await shown(page, 'randomize-confirm-modal'));
    const question = await page.textContent('#randomize-confirm-modal');
    assert('asks the question', question.includes('are you sure you want to forego all creativity to an algorithm?'));
    assert('warns about replacing', question.includes('Your current zine will be replaced.'));
    await page.click('#randomize-no-btn');
    assert('No closes it', !(await shown(page, 'randomize-confirm-modal')));
    assert('No leaves the zine unchanged', before === await page.evaluate(() => JSON.stringify(state.pages)));
    await page.click('#randomize-btn');
    await page.keyboard.press('Escape');
    assert('Escape closes it, zine unchanged', !(await shown(page, 'randomize-confirm-modal')) &&
        before === await page.evaluate(() => JSON.stringify(state.pages)));

    console.log('[Yes from a rotated single-page zine]');
    await page.selectOption('#page-format', 'single-page');
    await page.click('#rotate-right-btn');
    await page.evaluate(() => { state.meta.info = { name: 'Ana' }; });
    await page.click('#randomize-btn');
    await page.click('#randomize-yes-btn');
    const after = await page.evaluate(() => ({
        format: state.pageFormat,
        select: document.getElementById('page-format').value,
        roles: state.pages.map(p => p.role),
        rotation: state.viewRotation,
        info: JSON.stringify(state.meta.info),
        theirInfo: state.pages.find(p => p.role === 'their-info').elements.length,
        flyers: state.pages.some(p => p.elements.some(e => String(e.src || '').includes('images/flyers/'))),
        title: state.pages[0].elements.some(e => e.content === 'Ephemera Eternal'),
        layoutLeft: state.pages.some(p => 'layout' in p),
        placeholders: state.pages.some(p => p.elements.some(e => /\[\w+\]/.test(e.content || '')))
    }));
    assert('switched to half-letter, select follows', after.format === 'half-letter' && after.select === 'half-letter');
    assert('27 pages: front cover, Your info, 24 inside, back cover', after.roles.length === 27 &&
        after.roles[0] === 'front-cover' && after.roles[1] === 'their-info' && after.roles[26] === 'back-cover' &&
        after.roles.filter(r => r === 'inside').length === 24);
    assert('view rotation back to 0', after.rotation === 0);
    assert('Your info page and form cleared', after.theirInfo === 0 && after.info === '{}');
    assert('no flyers', !after.flyers);
    assert('front cover titled Ephemera Eternal', after.title);
    assert('composer layout tags stripped', !after.layoutLeft);
    assert('no unexpanded grammar placeholders', !after.placeholders);
    assert('a symbol the grammar lacks gives no text', await page.evaluate(() => Randomize.line('no_such_symbol') === ''));

    console.log('[IBM dialog]');
    assert('opens after Yes', await shown(page, 'randomize-done-modal'));
    assert('shows ibm.png, loaded', await page.$eval('#randomize-done-modal img', img => img.src.endsWith('images/clipart/ibm.png') && img.naturalWidth > 0));
    assert('says the line', (await page.textContent('#randomize-done-modal')).includes('this image is correct: insert your information, please.'));
    await page.click('#randomize-ok-btn');
    assert('OK closes it', !(await shown(page, 'randomize-done-modal')));
    assert('OK lands on Your info with the form showing, empty', await page.evaluate(() =>
        getCurrentPage().role === 'their-info' && !document.getElementById('info-form-panel').hidden &&
        document.getElementById('info-name').value === ''));

    console.log('[Escape on the IBM dialog acts as OK]');
    await page.click('.page-tab[data-page="0"]');
    await page.click('#randomize-btn');
    await page.click('#randomize-yes-btn');
    await page.keyboard.press('Escape');
    assert('closed and on Your info', !(await shown(page, 'randomize-done-modal')) &&
        await page.evaluate(() => getCurrentPage().role === 'their-info'));

    console.log('[autosave]');
    const firstText = await page.evaluate(async () => {
        await Autosave.flush();
        return JSON.stringify(state.pages[2].elements.map(e => e.content || e.src));
    });
    await page.reload();
    await page.waitForFunction(() => typeof Autosave !== 'undefined' && Autosave.enabled);
    assert('reload brings back the randomized zine', await page.evaluate(first =>
        state.pages.length === 27 && JSON.stringify(state.pages[2].elements.map(e => e.content || e.src)) === first, firstText));
    await session.close();

    console.log('[?opening-night leaves the back cover alone]');
    session = await open(undefined, '?opening-night');
    page = session.page;
    await dataLoaded(page);
    const backBefore = await page.evaluate(() => {
        const back = state.pages.find(p => p.role === 'back-cover');
        back.elements.push(Object.assign(createTextElement(60, 60), { content: 'my back cover' }));
        return JSON.stringify(back);
    });
    await page.click('#randomize-btn');
    await page.click('#randomize-yes-btn');
    await page.click('#randomize-ok-btn');
    const night = await page.evaluate(() => ({
        back: JSON.stringify(state.pages.find(p => p.role === 'back-cover')),
        count: state.pages.length,
        insideFilled: state.pages.filter(p => p.role === 'inside').every(p => p.elements.length > 0)
    }));
    assert('back cover page carried over untouched', night.back === backBefore);
    assert('the rest is randomized', night.count === 27 && night.insideFilled);

    await session.close();
    done();
})();
```

- [ ] **Step 2: Run it to verify it fails**

Run (repo root): `CHROME_PATH=$(ls ~/.cache/ms-playwright/chromium_headless_shell-1223/*/chrome-headless-shell) NODE_PATH=$S/node_modules node tests/browser/randomize.cjs`
Expected: FAIL — `page.click: ... waiting for locator('#randomize-btn')` timeout.

- [ ] **Step 3: Add the markup**

In `index.html`, after the `New` button line (`<button class="btn btn-tertiary" id="new-zine-btn" ...>New</button>`), add:

```html
                <button class="btn btn-secondary" id="randomize-btn" title="Hand the whole zine to an algorithm">Randomize</button>
```

After the closing `</div>` of `#booklet-export-modal` (just before the html2canvas `<script>`), add:

```html
    <!-- Randomize: confirm, then the IBM slide -->
    <div class="preview-modal" id="randomize-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="randomize-confirm-title">
        <div class="booklet-export-dialog">
            <h2 id="randomize-confirm-title">are you sure you want to forego all creativity to an algorithm?</h2>
            <p class="booklet-export-note">Your current zine will be replaced.</p>
            <button class="btn" id="randomize-yes-btn">Yes</button>
            <button class="btn btn-tertiary" id="randomize-no-btn">No</button>
        </div>
    </div>

    <div class="preview-modal" id="randomize-done-modal" role="dialog" aria-modal="true" aria-labelledby="randomize-done-title">
        <div class="booklet-export-dialog">
            <img class="randomize-ibm" src="images/clipart/ibm.png" alt="IBM slide: A computer can never be held accountable. Therefore a computer must never make a management decision.">
            <h2 id="randomize-done-title">this image is correct: insert your information, please.</h2>
            <button class="btn" id="randomize-ok-btn">OK</button>
        </div>
    </div>
```

After `<script src="js/openingnight.js"></script>`, add:

```html
    <script src="js/randomize.js"></script>
```

In `css/editor.css`, after the `.booklet-export-note { ... }` rule, add:

```css
.randomize-ibm {
    width: 100%;
    height: auto;
    border-radius: 3px;
    margin-bottom: 8px;
}
```

- [ ] **Step 4: Add the UI wiring**

In `js/randomize.js`, insert above the `if (typeof module !== 'undefined' ...)` block:

```js
const Randomize = {
    init: function () {
        const confirmModal = document.getElementById('randomize-confirm-modal');
        const doneModal = document.getElementById('randomize-done-modal');
        document.getElementById('randomize-btn').addEventListener('click', () => confirmModal.classList.add('show'));
        document.getElementById('randomize-no-btn').addEventListener('click', () => confirmModal.classList.remove('show'));
        document.getElementById('randomize-yes-btn').addEventListener('click', () => {
            confirmModal.classList.remove('show');
            Randomize.apply();
            doneModal.classList.add('show');
        });
        document.getElementById('randomize-ok-btn').addEventListener('click', Randomize.finish);
        // A backdrop click or Escape answers No on the confirm dialog and OK on the IBM dialog
        confirmModal.addEventListener('click', e => { if (e.target === confirmModal) confirmModal.classList.remove('show'); });
        doneModal.addEventListener('click', e => { if (e.target === doneModal) Randomize.finish(); });
        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape') return;
            if (confirmModal.classList.contains('show')) confirmModal.classList.remove('show');
            else if (doneModal.classList.contains('show')) Randomize.finish();
        });
    },

    // A symbol the grammar doesn't have (or hasn't loaded yet) gives no text, not "[symbol]"
    line: function (symbol) {
        const options = state.grammar && state.grammar[symbol];
        return options && options.length ? Tracery.expand(state.grammar, symbol).trim() : '';
    },

    apply: function () {
        const oldBack = (state.pages || []).find(page => page.role === 'back-cover');
        const pages = composeZine({
            line: Randomize.line,
            clipart: state.clipartImages || [],
            photos: state.photoImages || [],
            fonts: randomFontLists(fontSources, state.fonts || {}),
            rng: Math.random,
            newId: generateId,
            insidePages: MAX_INSIDE_PAGES
        });
        pages.forEach(page => { delete page.layout; });
        // Opening night: the back cover is the fixed text page, so its stored page stays as it was
        if (OpeningNight.active) pages[pages.length - 1] = oldBack || { id: generateId(), role: 'back-cover', elements: [] };
        state.pageFormat = 'half-letter';
        state.pages = pages;
        state.meta.info = {};
        state.currentPage = 0;
        state.viewRotation = 0;
        state.selectedId = null;
        state.editingId = null;
        render();
    },

    finish: function () {
        document.getElementById('randomize-done-modal').classList.remove('show');
        state.currentPage = state.pages.findIndex(page => page.role === 'their-info');
        state.selectedId = null;
        state.editingId = null;
        render();
    }
};
```

In `js/editor.js`, in the `DOMContentLoaded` handler at the end of the file, after `OpeningNight.init();` add:

```js
    Randomize.init();
```

- [ ] **Step 5: Run the browser check to verify it passes**

Run: `CHROME_PATH=$(ls ~/.cache/ms-playwright/chromium_headless_shell-1223/*/chrome-headless-shell) NODE_PATH=$S/node_modules node tests/browser/randomize.cjs`
Expected: `N passed, 0 failed`. If `state.meta` is missing after an autosave restore, `state.meta.info = {}` will throw — guard with `state.meta = Object.assign({}, state.meta, { info: {} });` instead.

- [ ] **Step 6: README**

In `README.md`, before `## Browser checks`, add:

```markdown
### Randomize

**Randomize** in the top bar asks "are you sure you want to forego all creativity to an
algorithm?". Yes replaces the zine with a half-letter booklet of 24 inside pages plus covers,
each page a random layout (big image, poem, collage, photo + slogan) of grammar lines, clip art
and Adam Goldman's photos — never flyers. The front cover is always titled "Ephemera Eternal"
with a random subtitle. Your info is left blank, and the IBM slide then sends the person there.
In `?opening-night` mode the back cover is left alone. Everything stays editable.
```

In the file-layout list, after the `js/openingnight.js` line, add:

```markdown
- `js/randomize.js` — Randomize: random layout composer (pure, Node-tested) and its dialogs
```

- [ ] **Step 7: Full test run**

Run:
```bash
export CHROME_PATH=$(ls ~/.cache/ms-playwright/chromium_headless_shell-1223/*/chrome-headless-shell) NODE_PATH=$S/node_modules
for t in tests/browser/[!h]*.cjs; do echo "== $t"; node $t | tail -1; done
for t in js/*.test.js; do echo "== $t"; node $t | tail -1; done
```
Expected: every line `0 failed`.

- [ ] **Step 8: Render a randomized PDF for Glenn**

Write `$S/random-pdf.cjs`:

```js
const { open } = require('/home/user/Documents/repos/ephemera-eternal/tests/browser/harness.cjs');
const fs = require('fs');
(async () => {
    const { page, close } = await open();
    await page.waitForFunction(() => state.photoImages.length && state.clipartImages.length && state.grammar.slogan && state.organizer);
    await page.click('#randomize-btn');
    await page.click('#randomize-yes-btn');
    await page.click('#randomize-ok-btn');
    const b64 = await page.evaluate(async () => {
        document.querySelector('.canvas-container').classList.add('hide-guides');
        state.selectedId = null;
        const pdf = await buildBookletPdf('duplex');
        return pdf.output('datauristring').split(',')[1];
    });
    fs.writeFileSync(process.argv[2], Buffer.from(b64, 'base64'));
    await close();
})();
```

Run: `node $S/random-pdf.cjs $S/random.pdf && pdftoppm -png -r 50 -f 1 -l 6 $S/random.pdf $S/random`
Then view `$S/random-1.png` … `random-6.png`. Check: the front cover reads "Ephemera Eternal" with a subtitle and image, nothing is cut off at the margins, slogans on photos are readable, and there are no flyers. Fix layout numbers in `js/randomize.js` if anything looks wrong (re-run Task 1's tests after any change), then show Glenn the images.

- [ ] **Step 9: Leave uncommitted** (Glenn commits himself).
