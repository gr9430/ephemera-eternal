# Poster Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone, phone-first page (`posters.html`) where show visitors scroll Glenn's posters, copy a poster's exact title, open a full-screen view, and tap Buy to reach one shared storefront link.

**Architecture:** One static page with its own CSS and one script, `js/postergallery.js`. The script's top half is pure helpers (validation, store link, index stepping, swipe direction) exported for a Node test; its bottom half is a `PosterGallery` object that fetches `data/poster-gallery.json`, renders cards, and drives a native `<dialog>` viewer. No build step, no libraries.

**Tech Stack:** Plain HTML/CSS/JS (browser globals + `module.exports` guard, as in `js/clipart.js`), Node test scripts (`node js/<name>.test.js`), Playwright browser checks (`tests/browser/*.cjs`).

**Spec:** `docs/superpowers/specs/2026-10-09-poster-gallery-design.md`

## Global Constraints

- Mobile first: base CSS targets a ~360–430px portrait phone; wider layouts only via `min-width` media queries (2 columns from 700px, 3 from 1100px).
- Touch targets ≥ 44px tall; body text 16px; no horizontal scrolling; safe-area insets respected; viewport meta must not disable user scaling.
- No external fonts, libraries, or CDN requests on `posters.html`. It loads only `css/postergallery.css` and `js/postergallery.js`.
- Data file is `data/poster-gallery.json` (not `data/poster.json`, which is the editor's credit line).
- Required poster fields: `id`, `title`, `src`, `alt`; optional `details`. Ids unique; titles unique case-insensitively after trimming.
- `storeUrl` is empty or an `http(s)` URL. Empty or invalid → no Buy buttons anywhere.
- The page names no payment service. Exact UI strings: `Copy title`, `Copied ✓`, `Select & copy`, `Buy →`, `Posters couldn’t load — please refresh.`, intro line `Find a poster you like, copy its title, then tap Buy and enter the title at the store.`
- Not linked from the editor (`index.html` is untouched).
- **Commits:** the working tree has a lot of Glenn's uncommitted work. Stage only the exact files each task names; never `git add -A`/`.`. Do **not** commit `README.md` (it has unrelated uncommitted edits) or anything under `tests/` other than `tests/browser/postergallery.cjs`. Don't modify `tests/browser/harness.cjs`.

## Review Focus

1. **Long unbroken titles on a 375px phone** — must wrap inside the card; page never scrolls sideways. (Task 2 test.)
2. **Clipboard blocked** (in-app browsers opened by QR scanner/social apps, or a non-HTTPS URL) — title gets selected for manual copy and the button says `Select & copy`; nothing throws. (Task 2 test.)
3. **Back gesture with the viewer open** — closes the viewer and stays on the gallery; closing by ✕ or Esc leaves no stray history entry; a reload with the viewer's history state doesn't strand a phantom entry. (Task 3 tests.)
4. **Store link typed without `https://` or with spaces** — Buy hidden on the page, and the Node data test fails so it's caught before the show. (Tasks 1 and 2 tests.)
5. **Two-finger pinch or a short drag in the viewer** — must not change poster. (Task 3 test.)

---

### Task 1: Data helpers, data file, Node test

**Files:**
- Create: `js/postergallery.js`
- Create: `js/postergallery.test.js`
- Create: `data/poster-gallery.json`
- Create: `images/posters/.gitkeep`

**Interfaces:**
- Produces (browser globals and `module.exports`):
  - `validatePosters(data) → string[]` — errors for the whole file object `{ storeUrl, posters }`; `[]` means valid.
  - `usablePosters(list) → object[]` — entries with every required field, original order.
  - `storeLink(url) → string` — trimmed URL if `http(s)` with no spaces, else `''`.
  - `stepIndex(index, delta, count) → number` — `index + delta` if within `[0, count)`, else `index`.
  - `swipeDirection(dx, dy) → -1 | 0 | 1` — `1` = next (swipe left), `-1` = previous, `0` = not a swipe.
  - `hasText(v) → boolean` — non-empty string after trim (used by Task 2).

- [ ] **Step 1: Write the failing test** — `js/postergallery.test.js`:

```js
/**
 * postergallery.test.js — Node.js tests for the pure helpers in postergallery.js and for the
 * shape of data/poster-gallery.json. No DOM required; the page itself is covered by
 * tests/browser/postergallery.cjs.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { validatePosters, usablePosters, storeLink, stepIndex, swipeDirection } = require('./postergallery.js');

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

const valid = { id: 'p1', title: 'Night Market', src: 'images/posters/a.jpg', alt: 'a poster' };
const other = { id: 'p2', title: 'Last Call', src: 'images/posters/b.jpg', alt: 'another poster' };
const file = (posters, storeUrl = '') => ({ storeUrl, posters });
const with_ = (changes) => Object.assign({}, valid, changes);

console.log('[validatePosters]');
assert('a complete file has no errors', validatePosters(file([valid, other])).length === 0);
assert('an empty poster list is fine', validatePosters(file([])).length === 0);
assert('optional details are allowed', validatePosters(file([with_({ details: '18×24 · 2025' })])).length === 0);
assert('non-text details are reported',
    validatePosters(file([with_({ details: 2025 })])).some(e => e.includes('details')));
['id', 'title', 'src', 'alt'].forEach(f => {
    assert('a missing ' + f + ' is reported',
        validatePosters(file([with_({ [f]: undefined })])).some(e => e.includes(f)));
});
assert('a whitespace-only title is reported',
    validatePosters(file([with_({ title: '   ' })])).some(e => e.includes('title')));
assert('duplicate ids are reported',
    validatePosters(file([valid, with_({ title: 'Something Else' })])).some(e => e.includes('duplicate id')));
assert('titles differing only in case and spaces are duplicates',
    validatePosters(file([valid, with_({ id: 'p9', title: '  night MARKET ' })])).some(e => e.includes('duplicate title')));
assert('https store link is fine', validatePosters(file([], 'https://store.example/posters')).length === 0);
assert('http store link is fine', validatePosters(file([], 'http://store.example/posters')).length === 0);
assert('store link without a scheme is reported',
    validatePosters(file([], 'store.example/posters')).some(e => e.includes('storeUrl')));
assert('javascript: store link is reported',
    validatePosters(file([], 'javascript:alert(1)')).some(e => e.includes('storeUrl')));
assert('a missing storeUrl is reported',
    validatePosters({ posters: [] }).some(e => e.includes('storeUrl')));
assert('a non-object file is reported', validatePosters([]).length > 0);
assert('a non-list posters is reported', validatePosters({ storeUrl: '', posters: {} }).some(e => e.includes('posters')));

console.log('\n[usablePosters]');
assert('skips entries missing a required field, keeps order',
    eq(usablePosters([valid, { id: 'x', title: 'No image' }, null, other]).map(p => p.id), ['p1', 'p2']));
assert('a non-list gives no posters', eq(usablePosters(undefined), []));

console.log('\n[storeLink]');
assert('trims a good link', storeLink('  https://store.example/x  ') === 'https://store.example/x');
assert('empty stays empty', storeLink('') === '');
assert('no scheme gives empty', storeLink('store.example/x') === '');
assert('spaces inside give empty', storeLink('https://store example/x') === '');
assert('non-string gives empty', storeLink(undefined) === '');

console.log('\n[stepIndex]');
assert('next moves forward', stepIndex(0, 1, 3) === 1);
assert('next stops at the last poster', stepIndex(2, 1, 3) === 2);
assert('previous moves back', stepIndex(1, -1, 3) === 0);
assert('previous stops at the first poster', stepIndex(0, -1, 3) === 0);

console.log('\n[swipeDirection]');
assert('swipe left is next', swipeDirection(-120, 10) === 1);
assert('swipe right is previous', swipeDirection(120, 10) === -1);
assert('a short drag is not a swipe', swipeDirection(-30, 0) === 0);
assert('a mostly vertical drag is not a swipe', swipeDirection(-100, 90) === 0);
assert('no movement is not a swipe', swipeDirection(0, 0) === 0);

console.log('\n[data/poster-gallery.json]');
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'poster-gallery.json'), 'utf8'));
const errors = validatePosters(data);
assert('the file passes validatePosters' + (errors.length ? ' — ' + errors.join('; ') : ''), errors.length === 0);
(Array.isArray(data.posters) ? data.posters : []).forEach(p => {
    assert('image file exists for ' + p.id, fs.existsSync(path.join(root, p.src)));
});

console.log('\n──────────────────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node js/postergallery.test.js`
Expected: crash with `Cannot find module './postergallery.js'`.

- [ ] **Step 3: Write the helpers** — `js/postergallery.js`:

```js
// postergallery.js — the public poster gallery (posters.html): Glenn's show posters and one shared
// store link. Visitors copy a poster's exact title and enter it at the store; price and
// availability live on the storefront. The helpers below are pure (Node-tested); PosterGallery
// builds the page and the full-screen viewer.

const POSTER_REQUIRED = ['id', 'title', 'src', 'alt'];
const SWIPE_MIN = 50;

function hasText(v) {
    return typeof v === 'string' && v.trim() !== '';
}

function storeLink(url) {
    if (typeof url !== 'string') return '';
    const u = url.trim();
    return /^https?:\/\/\S+$/i.test(u) ? u : '';
}

function validatePosters(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return ['poster-gallery.json must be an object with storeUrl and posters'];
    }
    const errors = [];
    if (typeof data.storeUrl !== 'string' || (data.storeUrl.trim() !== '' && !storeLink(data.storeUrl))) {
        errors.push('storeUrl must be empty or an http(s) URL with no spaces');
    }
    if (!Array.isArray(data.posters)) {
        errors.push('posters must be a list');
        return errors;
    }
    const ids = new Set(), titles = new Set();
    data.posters.forEach((p, i) => {
        const name = p && hasText(p.id) ? p.id : 'entry ' + i;
        POSTER_REQUIRED.forEach(f => {
            if (!p || !hasText(p[f])) errors.push(name + ': missing ' + f);
        });
        if (!p) return;
        if (p.details !== undefined && typeof p.details !== 'string') errors.push(name + ': details must be text');
        if (hasText(p.id)) {
            if (ids.has(p.id)) errors.push(name + ': duplicate id');
            ids.add(p.id);
        }
        if (hasText(p.title)) {
            const key = p.title.trim().toLowerCase();
            if (titles.has(key)) errors.push(name + ': duplicate title "' + p.title.trim() + '"');
            titles.add(key);
        }
    });
    return errors;
}

function usablePosters(list) {
    return Array.isArray(list) ? list.filter(p => p && POSTER_REQUIRED.every(f => hasText(p[f]))) : [];
}

function stepIndex(index, delta, count) {
    const next = index + delta;
    return next >= 0 && next < count ? next : index;
}

function swipeDirection(dx, dy) {
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) <= 1.5 * Math.abs(dy)) return 0;
    return dx < 0 ? 1 : -1;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { hasText, storeLink, validatePosters, usablePosters, stepIndex, swipeDirection };
}
```

Create `data/poster-gallery.json`:

```json
{
  "storeUrl": "",
  "posters": []
}
```

Create an empty `images/posters/.gitkeep`.

- [ ] **Step 4: Run the test to make sure it passes**

Run: `node js/postergallery.test.js`
Expected: every line `PASS`, ends `Results: N passed, 0 failed`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add js/postergallery.js js/postergallery.test.js data/poster-gallery.json images/posters/.gitkeep
git commit -m "Poster gallery: data helpers, data file, Node test"
```

---

### Task 2: Gallery page — cards, Copy title, Buy, errors, mobile-first CSS

**Files:**
- Create: `posters.html`
- Create: `css/postergallery.css`
- Modify: `js/postergallery.js` (add `PosterGallery` above the `module.exports` guard)
- Create: `tests/browser/postergallery.cjs`

**Interfaces:**
- Consumes: `hasText`, `storeLink`, `usablePosters` from Task 1.
- Produces for Task 3:
  - `PosterGallery.posters` (usable posters, file order), `PosterGallery.store` (clean link or `''`).
  - `PosterGallery.image(poster, loading) → HTMLImageElement` (swaps itself for a `.poster-missing` span on error).
  - `PosterGallery.info(poster) → HTMLDivElement` (title `h2.poster-title`, optional `p.poster-details`, `.poster-actions` with `.btn-copy` and, when a store link exists, `a.btn-buy`).
  - Card markup: `li.poster-card > button.poster-open > img.poster-img` followed by `.poster-info`.
  - Browser check file ending with `await browser.close(); server.close(); done();` — Task 3 inserts before that.

- [ ] **Step 1: Write the failing browser check** — `tests/browser/postergallery.cjs`:

```js
// postergallery.cjs — the public poster gallery (posters.html) on a phone: cards, Copy title and
// its fallback, Buy, a missing image, bad or missing data, wider layouts, and the full-screen viewer.
// harness.cjs opens index.html, so this check serves the repo itself and reuses only assert/done.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { assert, done } = require('./harness.cjs');

const ROOT = path.join(__dirname, '..', '..');
const TYPES = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'
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

const PHONE = { viewport: { width: 375, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const LONG = 'Averyveryverylongtitlewithnospacesatallthatmustwrapsomehowonaphonescreenwithoutscrolling';
const FIXTURE = {
    storeUrl: 'https://store.example/posters',
    posters: [
        { id: 'p1', title: '  First <Show> & "Friends"  ', src: 'images/clipart/eyes.png', alt: 'eyes', details: '18×24 screenprint · 2025' },
        { id: 'p2', title: LONG, src: 'images/clipart/bldg.png', alt: 'a building' },
        { id: 'p3', title: 'Third', src: 'images/posters/does-not-exist.jpg', alt: 'a missing poster' },
        { id: 'bad', title: '', src: 'images/clipart/cam.png', alt: 'skipped' }
    ]
};
const TITLES = ['First <Show> & "Friends"', LONG, 'Third'];

async function openGallery(browser, port, data) {
    const context = await browser.newContext(Object.assign({ permissions: ['clipboard-read', 'clipboard-write'] }, PHONE));
    const page = await context.newPage();
    page.on('pageerror', error => console.log('  PAGE ERROR: ' + error.message));
    await page.route('**/data/poster-gallery.json', route => data === null
        ? route.fulfill({ status: 500, body: '' })
        : route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
    await page.goto(`http://localhost:${port}/posters.html`);
    await page.waitForFunction(() => document.querySelector('.poster-card') ||
        !document.getElementById('gallery-message').hidden);
    return { page, context };
}

const card = (page, i) => page.locator('.poster-card').nth(i);

(async () => {
    const server = await serve();
    const port = server.address().port;
    const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
    const { page, context } = await openGallery(browser, port, FIXTURE);

    console.log('[cards on a phone]');
    assert('invalid entries skipped, file order kept, titles trimmed',
        JSON.stringify(await page.$$eval('.poster-card .poster-title', ts => ts.map(t => t.textContent))) === JSON.stringify(TITLES));
    assert('title text is shown literally, not parsed as HTML',
        await card(page, 0).evaluate(c => c.querySelector('show') === null));
    assert('details shown when present', (await card(page, 0).locator('.poster-details').textContent()) === '18×24 screenprint · 2025');
    assert('no details line when absent', (await card(page, 1).locator('.poster-details').count()) === 0);
    const lefts = await page.$$eval('.poster-card', cs => cs.map(c => Math.round(c.getBoundingClientRect().left)));
    assert('one column', new Set(lefts).size === 1);
    assert('cards fill the width inside 16px gutters',
        await card(page, 0).evaluate(c => Math.round(c.getBoundingClientRect().width) === 375 - 32));
    assert('no horizontal scroll, even with a long unbroken title',
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    assert('buttons are at least 44px tall',
        await page.$$eval('.poster-card .btn', bs => bs.length > 0 && bs.every(b => b.getBoundingClientRect().height >= 44)));
    assert('body text is 16px', await page.evaluate(() => getComputedStyle(document.body).fontSize === '16px'));
    assert('card images load lazily', await page.$$eval('.poster-card img', is => is.every(i => i.loading === 'lazy')));
    assert('page zoom is not disabled',
        await page.$eval('meta[name=viewport]', m => !/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\D|$)/.test(m.content)));
    assert('no requests leave the page\'s own origin',
        await page.evaluate(() => performance.getEntriesByType('resource').every(r => r.name.startsWith(location.origin))));

    console.log('[Copy title]');
    await card(page, 0).locator('.btn-copy').click();
    await page.waitForFunction(() => document.querySelector('.poster-card .btn-copy').textContent === 'Copied ✓');
    assert('clipboard holds the exact title', (await page.evaluate(() => navigator.clipboard.readText())) === TITLES[0]);
    await page.waitForFunction(() => document.querySelector('.poster-card .btn-copy').textContent === 'Copy title', null, { timeout: 4000 });
    assert('button label resets', true);

    console.log('[Copy title when the clipboard is blocked]');
    await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText',
        { value: () => Promise.reject(new Error('denied')), configurable: true }));
    await card(page, 1).locator('.btn-copy').click();
    await page.waitForFunction(() => document.querySelectorAll('.poster-card .btn-copy')[1].textContent === 'Select & copy');
    assert('the title is selected for a manual copy', (await page.evaluate(() => window.getSelection().toString())) === TITLES[1]);

    console.log('[Buy]');
    const buy = await card(page, 0).locator('.btn-buy').evaluate(a => ({ href: a.href, target: a.target, rel: a.rel, text: a.textContent }));
    assert('Buy goes to the store link in a new tab',
        buy.href === FIXTURE.storeUrl && buy.target === '_blank' && buy.rel.includes('noopener') && buy.text === 'Buy →');

    console.log('[missing image]');
    await card(page, 2).scrollIntoViewIfNeeded();
    await page.waitForSelector('.poster-card:nth-child(3) .poster-missing', { timeout: 5000 });
    assert('the card shows the alt text in place of the image',
        (await card(page, 2).locator('.poster-missing').textContent()) === 'a missing poster' &&
        (await card(page, 2).locator('img').count()) === 0);
    assert('title and buttons stay', (await card(page, 2).locator('.poster-title').textContent()) === 'Third' &&
        (await card(page, 2).locator('.btn').count()) === 2);

    console.log('[wider screens]');
    const columns = async () => new Set(await page.$$eval('.poster-card', cs => cs.map(c => Math.round(c.getBoundingClientRect().left)))).size;
    await page.setViewportSize({ width: 800, height: 900 });
    assert('two columns from 700px', (await columns()) === 2);
    await page.setViewportSize({ width: 1200, height: 900 });
    assert('three columns from 1100px', (await columns()) === 3);
    await page.setViewportSize(PHONE.viewport);
    await context.close();

    console.log('[no or bad store link]');
    for (const storeUrl of ['', 'store.example/no-scheme']) {
        const g = await openGallery(browser, port, Object.assign({}, FIXTURE, { storeUrl }));
        assert('no Buy buttons for "' + storeUrl + '"', (await g.page.locator('.btn-buy').count()) === 0);
        assert('Copy title still there for "' + storeUrl + '"', (await g.page.locator('.btn-copy').count()) === 3);
        await g.context.close();
    }

    console.log('[data fails to load]');
    {
        const g = await openGallery(browser, port, null);
        assert('shows the refresh message',
            (await g.page.$eval('#gallery-message', m => !m.hidden && m.textContent)) === 'Posters couldn’t load — please refresh.');
        await g.context.close();
    }

    await browser.close();
    server.close();
    done();
})();
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `NODE_PATH=/home/user/.cache/ephemera-eternal-tools/node_modules node tests/browser/postergallery.cjs`
Expected: fails/times out in `openGallery` — `posters.html` doesn't exist (404). (If Chromium fails to launch, set `CHROME_PATH`; Playwright's browsers are in `~/.cache/ms-playwright`.)

- [ ] **Step 3: Create the page** — `posters.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>Posters — Ephemera Eternal</title>
    <link rel="stylesheet" href="css/postergallery.css">
</head>
<body>
    <header class="gallery-header">
        <h1>Ephemera Eternal — Posters</h1>
        <p class="gallery-intro">Find a poster you like, copy its title, then tap Buy and enter the title at the store.</p>
    </header>
    <main>
        <p class="gallery-message" id="gallery-message" role="status" hidden></p>
        <ul class="poster-list" id="poster-list"></ul>
    </main>
    <script src="js/postergallery.js"></script>
    <script>PosterGallery.init();</script>
</body>
</html>
```

- [ ] **Step 4: Add `PosterGallery`** — insert into `js/postergallery.js` directly above the `if (typeof module !== 'undefined' ...)` guard:

```js
const PosterGallery = {
    posters: [],
    store: '',

    init: function () {
        fetch('data/poster-gallery.json')
            .then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(data => {
                this.posters = usablePosters(data.posters);
                this.store = storeLink(data.storeUrl);
                this.render();
            })
            .catch(() => this.showMessage('Posters couldn’t load — please refresh.'));
    },

    showMessage: function (text) {
        const message = document.getElementById('gallery-message');
        message.textContent = text;
        message.hidden = false;
    },

    render: function () {
        const list = document.getElementById('poster-list');
        list.innerHTML = '';
        if (!this.posters.length) {
            this.showMessage('No posters yet.');
            return;
        }
        this.posters.forEach((poster, index) => list.appendChild(this.card(poster, index)));
    },

    card: function (poster, index) {
        const item = document.createElement('li');
        item.className = 'poster-card';
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'poster-open';
        open.setAttribute('aria-label', 'Larger view: ' + poster.title.trim());
        open.appendChild(this.image(poster, 'lazy'));
        item.appendChild(open);
        item.appendChild(this.info(poster));
        return item;
    },

    image: function (poster, loading) {
        const img = document.createElement('img');
        img.className = 'poster-img';
        img.loading = loading;
        img.decoding = 'async';
        img.alt = poster.alt;
        img.addEventListener('error', () => {
            const missing = document.createElement('span');
            missing.className = 'poster-missing';
            missing.textContent = poster.alt;
            img.replaceWith(missing);
        });
        img.src = poster.src;
        return img;
    },

    info: function (poster) {
        const box = document.createElement('div');
        box.className = 'poster-info';
        const title = document.createElement('h2');
        title.className = 'poster-title';
        title.textContent = poster.title.trim();
        box.appendChild(title);
        if (hasText(poster.details)) {
            const details = document.createElement('p');
            details.className = 'poster-details';
            details.textContent = poster.details.trim();
            box.appendChild(details);
        }
        const actions = document.createElement('div');
        actions.className = 'poster-actions';
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'btn btn-copy';
        copy.textContent = 'Copy title';
        copy.addEventListener('click', () => this.copyTitle(title, copy));
        actions.appendChild(copy);
        if (this.store) {
            const buy = document.createElement('a');
            buy.className = 'btn btn-buy';
            buy.href = this.store;
            buy.target = '_blank';
            buy.rel = 'noopener';
            buy.textContent = 'Buy →';
            actions.appendChild(buy);
        }
        box.appendChild(actions);
        return box;
    },

    // Clipboard first; where it's blocked (in-app browsers, plain http), select the title so the
    // visitor can copy it by hand.
    copyTitle: function (titleEl, button) {
        const copied = () => {
            button.textContent = 'Copied ✓';
            clearTimeout(button.resetTimer);
            button.resetTimer = setTimeout(() => { button.textContent = 'Copy title'; }, 2000);
        };
        const selectInstead = () => {
            const range = document.createRange();
            range.selectNodeContents(titleEl);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            button.textContent = 'Select & copy';
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(titleEl.textContent).then(copied, selectInstead);
        } else {
            selectInstead();
        }
    }
};
```

- [ ] **Step 5: Add the stylesheet** — `css/postergallery.css` (base = phone; only `min-width` queries widen it):

```css
/* postergallery.css — posters.html. Phone first: the base rules are the phone layout; the
   min-width queries at the bottom only add columns. */

:root {
    --ink: #1a1a1a;
    --muted: #5b5b5b;
    --paper: #faf7f2;
    --frame: #ebe6de;
    --accent: rgb(122, 6, 97);
    --focus: #f2b400;
}

* { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; }

body {
    margin: 0;
    padding: 0 max(16px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
    background: var(--paper);
    color: var(--ink);
    font: 16px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

.gallery-header { padding: max(20px, env(safe-area-inset-top)) 0 8px; }
.gallery-header h1 { margin: 0 0 8px; font-size: 1.75rem; line-height: 1.15; }
.gallery-intro { margin: 0; color: var(--muted); }
.gallery-message { margin: 24px 0; font-weight: 600; }

.poster-list {
    list-style: none;
    margin: 16px 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 28px;
}

.poster-card { min-width: 0; }

/* Posters are portrait; contain keeps the whole poster visible without cropping, and the fixed
   ratio stops the page jumping while lazy images load. */
.poster-open {
    display: block;
    width: 100%;
    aspect-ratio: 3 / 4;
    padding: 0;
    border: 0;
    border-radius: 4px;
    overflow: hidden;
    background: var(--frame);
    cursor: zoom-in;
}

.poster-img { display: block; width: 100%; height: 100%; object-fit: contain; }

.poster-missing {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 16px;
    color: var(--muted);
    text-align: center;
}

.poster-info { padding-top: 12px; }

.poster-title {
    margin: 0;
    font-size: 1.375rem;
    line-height: 1.2;
    overflow-wrap: anywhere;
    -webkit-user-select: text;
    user-select: text;
}

.poster-details { margin: 4px 0 0; color: var(--muted); overflow-wrap: anywhere; }

.poster-actions { display: flex; gap: 10px; margin-top: 12px; }

.btn {
    flex: 1 1 0;
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 16px;
    border: 2px solid var(--accent);
    border-radius: 6px;
    font: inherit;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
}

.btn-copy { background: transparent; color: var(--accent); }
.btn-buy { background: var(--accent); color: #fff; }

.btn:focus-visible,
.poster-open:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }

@media (min-width: 700px) {
    .poster-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (min-width: 1100px) {
    .poster-list { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    main, .gallery-header { max-width: 1400px; margin-left: auto; margin-right: auto; }
}
```

- [ ] **Step 6: Run the checks to make sure they pass**

Run: `NODE_PATH=/home/user/.cache/ephemera-eternal-tools/node_modules node tests/browser/postergallery.cjs`
Expected: all `PASS`, `N passed, 0 failed`, no `PAGE ERROR` lines.
Run: `node js/postergallery.test.js` — still all pass.

- [ ] **Step 7: Commit**

```bash
git add posters.html css/postergallery.css js/postergallery.js tests/browser/postergallery.cjs
git commit -m "Poster gallery: phone-first page with Copy title and Buy"
```

---

### Task 3: Full-screen viewer — swipe, arrows, back gesture, focus

**Files:**
- Modify: `posters.html` (add the `<dialog>` after `</main>`)
- Modify: `js/postergallery.js` (`init`, `card`, new viewer methods)
- Modify: `css/postergallery.css` (viewer rules, appended before the media queries)
- Modify: `tests/browser/postergallery.cjs` (viewer section)

**Interfaces:**
- Consumes: `stepIndex`, `swipeDirection` (Task 1); `PosterGallery.posters`, `.image()`, `.info()`, card markup (Task 2).
- Produces: `PosterGallery.openViewer(index)`, `.closeViewer()`, `.step(delta)`; DOM ids `viewer`, `viewer-stage`, `viewer-info`, `viewer-close`, `viewer-prev`, `viewer-next`; history state `{ posterViewer: true }` while open.

Focus on close returns to the card of the **last poster viewed** (not necessarily the one first tapped), so a visitor who swiped ahead lands on that poster in the list.

History design (one rule, so every way of closing behaves the same): opening pushes `{ posterViewer: true }`. Back gesture → `popstate` → `dialog.close()`. Every close (✕, Esc, back) fires the dialog's `close` event; if the current history entry is still ours, it calls `history.back()` to drop it. On load, a leftover `posterViewer` state (from a reload while open) is replaced with `null`.

- [ ] **Step 1: Write the failing viewer checks** — in `tests/browser/postergallery.cjs`, add these helpers below the `card` helper:

```js
const viewerOpen = page => page.$eval('#viewer', d => d.open);
const viewerTitle = page => page.$eval('#viewer-info .poster-title', t => t.textContent);
const waitClosed = page => page.waitForFunction(() => !document.getElementById('viewer').open);
const ourState = page => page.evaluate(() => !!(history.state && history.state.posterViewer));

async function swipe(page, fromX, toX, fingers = 1) {
    await page.evaluate(({ fromX, toX, fingers }) => {
        const stage = document.getElementById('viewer-stage');
        const touches = x => Array.from({ length: fingers },
            (_, i) => new Touch({ identifier: i, target: stage, clientX: x + i * 40, clientY: 300 }));
        const fire = (type, list, changed) => stage.dispatchEvent(new TouchEvent(type,
            { touches: list, changedTouches: changed, bubbles: true, cancelable: true }));
        const start = touches(fromX), end = touches(toX);
        fire('touchstart', start, start);
        fire('touchmove', end, end);
        fire('touchend', [], end);
    }, { fromX, toX, fingers });
}
```

Then insert this block right **after** the `[missing image]` assertions and **before** `console.log('[wider screens]');`, so it runs at phone size:

```js
    console.log('[viewer]');
    await page.locator('.poster-open').nth(0).click();
    assert('tapping a poster opens the viewer', await viewerOpen(page));
    assert('it shows that poster', (await viewerTitle(page)) === TITLES[0] &&
        (await page.$eval('#viewer-stage img', i => i.src.endsWith('images/clipart/eyes.png'))));
    assert('it fills the phone screen', await page.$eval('#viewer', d => {
        const r = d.getBoundingClientRect();
        return Math.round(r.width) === 375 && Math.round(r.height) === 740;
    }));
    assert('it has Copy title and Buy', (await page.locator('#viewer-info .btn-copy').count()) === 1 &&
        (await page.locator('#viewer-info .btn-buy').count()) === 1);
    assert('opening adds a history entry', await ourState(page));
    assert('previous is disabled on the first poster', await page.$eval('#viewer-prev', b => b.disabled));

    await page.click('#viewer-next');
    assert('next shows the next poster', (await viewerTitle(page)) === TITLES[1]);
    await page.keyboard.press('ArrowRight');
    assert('right arrow moves on', (await viewerTitle(page)) === TITLES[2]);
    assert('next is disabled on the last poster', await page.$eval('#viewer-next', b => b.disabled));
    await page.keyboard.press('ArrowRight');
    assert('no wrap-around past the last poster', (await viewerTitle(page)) === TITLES[2]);
    await page.keyboard.press('ArrowLeft');
    assert('left arrow goes back', (await viewerTitle(page)) === TITLES[1]);

    console.log('[viewer swipe]');
    await swipe(page, 300, 100);
    assert('swipe left shows the next poster', (await viewerTitle(page)) === TITLES[2]);
    await swipe(page, 100, 300);
    assert('swipe right shows the previous poster', (await viewerTitle(page)) === TITLES[1]);
    await swipe(page, 300, 100, 2);
    assert('a two-finger pinch does not change poster', (await viewerTitle(page)) === TITLES[1]);
    await swipe(page, 200, 170);
    assert('a short drag does not change poster', (await viewerTitle(page)) === TITLES[1]);

    console.log('[viewer close]');
    await page.click('#viewer-close');
    await waitClosed(page);
    assert('✕ closes and removes the history entry', !(await ourState(page)));
    assert('focus returns to the last viewed poster',
        await page.evaluate(() => document.activeElement === document.querySelectorAll('.poster-open')[1]));

    await page.locator('.poster-open').nth(0).click();
    await page.keyboard.press('Escape');
    await waitClosed(page);
    assert('Esc closes and removes the history entry', !(await ourState(page)));

    await page.locator('.poster-open').nth(0).click();
    await page.evaluate(() => history.back());
    await waitClosed(page);
    assert('the back gesture closes the viewer and stays on the gallery',
        page.url().endsWith('/posters.html') && (await page.locator('.poster-card').count()) === 3);

    const lengthAfter = async () => {
        await page.locator('.poster-open').nth(0).click();
        await page.click('#viewer-close');
        await waitClosed(page);
        return page.evaluate(() => history.length);
    };
    const firstLength = await lengthAfter();
    assert('opening and closing again does not pile up history', (await lengthAfter()) === firstLength);

    console.log('[viewer state after a reload]');
    await page.locator('.poster-open').nth(0).click();
    await page.reload();
    await page.waitForSelector('.poster-card');
    assert('a reload starts closed with no leftover viewer history', !(await viewerOpen(page)) && !(await ourState(page)));
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `NODE_PATH=/home/user/.cache/ephemera-eternal-tools/node_modules node tests/browser/postergallery.cjs`
Expected: `[viewer]` assertions fail / `#viewer` not found.

- [ ] **Step 3: Add the dialog** — in `posters.html`, between `</main>` and the first `<script>`:

```html
    <dialog class="viewer" id="viewer" aria-label="Poster">
        <button type="button" class="viewer-close" id="viewer-close" aria-label="Close">✕</button>
        <button type="button" class="viewer-nav viewer-prev" id="viewer-prev" aria-label="Previous poster">‹</button>
        <button type="button" class="viewer-nav viewer-next" id="viewer-next" aria-label="Next poster">›</button>
        <div class="viewer-stage" id="viewer-stage"></div>
        <div class="viewer-info" id="viewer-info"></div>
    </dialog>
```

- [ ] **Step 4: Wire the viewer** in `js/postergallery.js`.

In `PosterGallery`, add two properties after `store: '',`:

```js
    current: -1,
    returnFocus: null,
```

In `init`, add as the first line of the function body:

```js
        this.initViewer();
```

In `card`, after `open.appendChild(this.image(poster, 'lazy'));` add:

```js
        open.addEventListener('click', () => this.openViewer(index));
```

Add these methods after `copyTitle` (add a comma after `copyTitle`'s closing brace):

```js
    initViewer: function () {
        const dialog = document.getElementById('viewer');
        // a reload while the viewer was open leaves its history entry behind
        if (history.state && history.state.posterViewer) history.replaceState(null, '');
        document.getElementById('viewer-close').addEventListener('click', () => this.closeViewer());
        document.getElementById('viewer-prev').addEventListener('click', () => this.step(-1));
        document.getElementById('viewer-next').addEventListener('click', () => this.step(1));
        document.addEventListener('keydown', e => {
            if (!dialog.open) return;
            if (e.key === 'ArrowLeft') this.step(-1);
            else if (e.key === 'ArrowRight') this.step(1);
        });
        // Every close (✕, Esc, back gesture) ends here; drop our history entry if it's still current.
        dialog.addEventListener('close', () => {
            this.current = -1;
            if (history.state && history.state.posterViewer) history.back();
            if (this.returnFocus) this.returnFocus.focus();
        });
        window.addEventListener('popstate', () => {
            if (dialog.open) dialog.close();
        });
        this.initSwipe(document.getElementById('viewer-stage'));
    },

    openViewer: function (index) {
        const dialog = document.getElementById('viewer');
        this.show(index);
        if (!dialog.open) {
            history.pushState({ posterViewer: true }, '');
            dialog.showModal();
            document.getElementById('viewer-close').focus();
        }
    },

    closeViewer: function () {
        document.getElementById('viewer').close();
    },

    show: function (index) {
        this.current = index;
        this.returnFocus = document.querySelectorAll('.poster-open')[index] || null;
        const poster = this.posters[index];
        const stage = document.getElementById('viewer-stage');
        stage.innerHTML = '';
        stage.appendChild(this.image(poster, 'eager'));
        const info = document.getElementById('viewer-info');
        info.innerHTML = '';
        info.appendChild(this.info(poster));
        const focused = document.activeElement;
        document.getElementById('viewer-prev').disabled = index === 0;
        document.getElementById('viewer-next').disabled = index === this.posters.length - 1;
        // a nav button that just became disabled drops focus to <body>; keep it in the viewer
        if (focused && focused.disabled) document.getElementById('viewer-close').focus();
    },

    step: function (delta) {
        const next = stepIndex(this.current, delta, this.posters.length);
        if (next !== this.current) this.show(next);
    },

    // One-finger horizontal swipes page through posters. Two fingers (pinch) and swipes while the
    // page is pinch-zoomed in are left to the browser so zoom and pan work normally.
    initSwipe: function (stage) {
        let start = null;
        stage.addEventListener('touchstart', e => {
            start = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
        }, { passive: true });
        stage.addEventListener('touchmove', e => {
            if (e.touches.length > 1) start = null;
        }, { passive: true });
        stage.addEventListener('touchend', e => {
            const from = start;
            start = null;
            if (!from || e.changedTouches.length !== 1) return;
            if (window.visualViewport && window.visualViewport.scale > 1.01) return;
            const delta = swipeDirection(e.changedTouches[0].clientX - from.x, e.changedTouches[0].clientY - from.y);
            if (delta) this.step(delta);
        });
    }
```

- [ ] **Step 5: Style the viewer** — append to `css/postergallery.css` **above** the first `@media` rule:

```css
/* Full-screen viewer. Pinch-zoom is the browser's own (the viewport meta allows scaling). */
body:has(.viewer[open]) { overflow: hidden; }

.viewer {
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    background: #111;
    color: #f4f1ec;
}

.viewer[open] { display: flex; flex-direction: column; }
.viewer::backdrop { background: #111; }

.viewer-stage {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: max(64px, env(safe-area-inset-top)) 8px 8px;
}

.viewer-stage .poster-missing { color: #ccc; }

.viewer-info {
    flex: 0 0 auto;
    max-height: 45%;
    overflow-y: auto;
    padding: 0 max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
}

.viewer .poster-title { color: #fff; }
.viewer .poster-details { color: #c9c4bc; }
.viewer .btn-copy { color: #fff; border-color: #fff; }

.viewer-close,
.viewer-nav {
    position: absolute;
    z-index: 1;
    border: 0;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    cursor: pointer;
}

.viewer-close {
    top: max(8px, env(safe-area-inset-top));
    right: max(8px, env(safe-area-inset-right));
    width: 48px;
    height: 48px;
    border-radius: 50%;
    font-size: 1.5rem;
}

.viewer-nav {
    top: 40%;
    transform: translateY(-50%);
    width: 48px;
    height: 64px;
    font-size: 2rem;
}

.viewer-prev { left: 0; border-radius: 0 6px 6px 0; }
.viewer-next { right: 0; border-radius: 6px 0 0 6px; }
.viewer-nav:disabled { opacity: 0.25; cursor: default; }

.viewer-close:focus-visible,
.viewer-nav:focus-visible { outline: 3px solid var(--focus); outline-offset: -3px; }
```

- [ ] **Step 6: Run the checks to make sure they pass**

Run: `NODE_PATH=/home/user/.cache/ephemera-eternal-tools/node_modules node tests/browser/postergallery.cjs`
Expected: all `PASS` including `[viewer]`, `[viewer swipe]`, `[viewer close]`, `[viewer state after a reload]`; no `PAGE ERROR`.
Run: `node js/postergallery.test.js` — still all pass.

- [ ] **Step 7: Commit**

```bash
git add posters.html css/postergallery.css js/postergallery.js tests/browser/postergallery.cjs
git commit -m "Poster gallery: full-screen viewer with swipe, arrows and back gesture"
```

---

### Task 4: README and phone check

**Files:**
- Modify: `README.md` (left **uncommitted** — it carries Glenn's other pending edits)

- [ ] **Step 1: Add a README section** — insert before `## Browser checks`:

````markdown
## Poster gallery

`posters.html` is a separate, phone-first page for buying Glenn's show posters. It isn't
linked from the editor: make a QR code (any QR generator) from its final URL, e.g.
`https://<site>/posters.html`, and put it on the wall. Visitors scroll, tap a poster for a
full-screen view (pinch to zoom, swipe for the next one), copy its title, and tap **Buy**,
which opens the store; they enter the title there. Price and availability live on the store.

1. Put the poster image in `images/posters/` (a phone-friendly size: about 1600px on the long
   side, JPEG or WebP).
2. Add an entry to `data/poster-gallery.json`, in the order you want them shown:

   ```json
   { "id": "p_night_market", "title": "Night Market",
     "src": "images/posters/night-market.jpg",
     "alt": "what the poster shows, for screen readers",
     "details": "18×24 screenprint · 2025 · for Band @ Venue" }
   ```

   `title` must match the store listing exactly — buyers type it in. `details` is optional.
3. Set `"storeUrl"` to the store link (with `https://`). While it's empty, the page shows no
   Buy buttons.
4. Run `node js/postergallery.test.js` — it checks required fields, unique ids and titles,
   that every image exists, and that the store link is a proper URL.

Copy title uses the clipboard, which browsers only allow over HTTPS. Over plain `http://`
(e.g. testing on a phone against `python3 -m http.server`) the button selects the title
instead and reads **Select & copy** — that's expected.
````

Also add to the `## File layout` list, after the `js/infoform.js` line:

```markdown
- `posters.html`, `js/postergallery.js`, `css/postergallery.css` — public poster gallery (`data/poster-gallery.json`; helpers Node-tested)
```

- [ ] **Step 2: Full test run**

Run: `node js/postergallery.test.js && NODE_PATH=/home/user/.cache/ephemera-eternal-tools/node_modules node tests/browser/postergallery.cjs`
Expected: both end with 0 failed.
Run: `for t in js/*.test.js; do node "$t" > /dev/null || echo "FAIL $t"; done`
Expected: no `FAIL` lines. This work touches no other test's code, so any failure here predates it — report it rather than fixing it.

- [ ] **Step 3: Manual phone check** (report results; do not tick without doing it)

Temporarily add one real or sample entry to `data/poster-gallery.json` (don't commit it), run `python3 -m http.server`, and open `http://<computer's LAN IP>:8000/posters.html` on a phone on the same Wi-Fi:
- scrolls smoothly in one column; title, details and both buttons readable and tappable;
- Copy title → `Select & copy` with the title highlighted (expected over http);
- tap image → full screen; pinch-zoom works; swipe left/right changes poster; phone back gesture closes the viewer and stays on the page;
- with `storeUrl` set, Buy opens it in a new tab and the gallery is still there on return.

Then revert the temporary data entry.

- [ ] **Step 4: Don't commit README** — report to Glenn that `README.md` holds the new section alongside their own uncommitted edits, for them to commit together.
