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

async function open(viewport = { width: 1600, height: 1000 }, query = '') {
    const server = await serve();
    const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
    const page = await browser.newPage({ viewport });
    page.on('pageerror', error => console.log('  PAGE ERROR: ' + error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto(`http://localhost:${server.address().port}/index.html${query}`);
    // index.html ships a static "Page 1" tab, so wait for the app's first render to replace it
    await page.waitForFunction(() => typeof Autosave !== 'undefined' && Autosave.enabled &&
        document.querySelectorAll('.page-tab').length === state.pages.filter(p => !OpeningNight.replaces(p.role)).length &&
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
