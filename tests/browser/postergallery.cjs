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
