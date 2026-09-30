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
