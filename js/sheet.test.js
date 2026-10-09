/**
 * sheet.test.js — Node.js test for the sheet helpers in store.js: page sizes per format.
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
vm.runInContext(read('booklet.js') + '\n' + read('store.js') +
    '\nthis.PAGE_SIZES = PAGE_SIZES; this.isPoster = isPoster; this.fitZoom = fitZoom; this.stepZoom = stepZoom; this.PROJECT_JSON_SKIP = PROJECT_JSON_SKIP; this.zineHasContent = zineHasContent;', sandbox);
const { PAGE_SIZES, isPoster, fitZoom, stepZoom, PROJECT_JSON_SKIP, zineHasContent } = sandbox;

console.log('[every format in the dropdown has a size]');
{
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const start = html.indexOf('id="page-format"');
    const block = html.slice(start, html.indexOf('</select>', start));
    const formats = [...block.matchAll(/<option value="([^"]+)"/g)].map(m => m[1]);
    assert('five formats listed', formats.join() === 'half-letter,single-page,stapled,poster-letter,poster-legal');
    assert('each has a size', formats.every(f => PAGE_SIZES[f] && PAGE_SIZES[f].w > 0 && PAGE_SIZES[f].h > 0));
}

console.log('[sizes, px at 96/in]');
const size = f => `${PAGE_SIZES[f].w}x${PAGE_SIZES[f].h}`;
assert('half-letter 528x816', size('half-letter') === '528x816');
assert('single-page 1056x816', size('single-page') === '1056x816');
assert('stapled 1056x816', size('stapled') === '1056x816');
assert('poster-letter 816x1056', size('poster-letter') === '816x1056');
assert('poster-legal 816x1344', size('poster-legal') === '816x1344');

console.log('[isPoster]');
assert('posters', isPoster('poster-letter') && isPoster('poster-legal'));
assert('not posters', !isPoster('half-letter') && !isPoster('single-page') && !isPoster('stapled') && !isPoster(undefined));

console.log('[data/poster.json]');
{
    const poster = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'poster.json'), 'utf8'));
    assert('credit is a non-empty string', typeof poster.credit === 'string' && poster.credit.trim().length > 0);
    // 10px Liberation Mono is ~6px a character; the strip is 768px wide
    assert('credit fits on one line (≤ 120 characters)', poster.credit.length <= 120);
}

console.log('[fitZoom]');
assert('legal poster in a laptop area: 0.63', fitZoom(1000, 900, 816, 1344, 0) === 0.63);
assert('never above 100%', fitZoom(3000, 3000, 528, 816, 0) === 1);
assert('a turned sheet fits by its turned box', fitZoom(1000, 900, 1056, 816, 90) === 0.81);
assert('never below 25%', fitZoom(100, 100, 816, 1344, 0) === 0.25);

console.log('[stepZoom]');
assert('100% up is 125%', stepZoom(1, 1) === 1.25);
assert('100% down is 75%', stepZoom(1, -1) === 0.75);
assert('off-grid Fit snaps to the next step up', stepZoom(0.63, 1) === 0.75);
assert('off-grid Fit snaps to the next step down', stepZoom(0.63, -1) === 0.5);
assert('75% up is exactly 100%', stepZoom(0.75, 1) === 1);
assert('stops at 200% and 25%', stepZoom(2, 1) === 2 && stepZoom(0.25, -1) === 0.25);

console.log('[zoom is never saved]');
assert('viewZoom skipped in project JSON', PROJECT_JSON_SKIP.includes('viewZoom'));

console.log('[zineHasContent]');
assert('empty pages: no', !zineHasContent([{ elements: [] }, { elements: [] }]));
assert('missing elements arrays: no', !zineHasContent([{}, { elements: undefined }]));
assert('info-form text only: no', !zineHasContent([{ elements: [{ fromInfoForm: true }, { fromInfoForm: true, locked: true }] }]));
assert('any other element: yes', zineHasContent([{ elements: [] }, { elements: [{ fromInfoForm: true }, { type: 'text' }] }]));
assert('no pages: no', !zineHasContent(undefined));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
