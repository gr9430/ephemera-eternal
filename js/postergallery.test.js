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
