/**
 * autosave.test.js — Node.js test for Autosave.serialize/apply in autosave.js.
 * Loads the real autosave.js into a sandbox with a stub state and document.
 *
 * Manual-verify items (IndexedDB/DOM only, untestable in Node):
 *   - Autosave.restore() / flush() — IndexedDB round trip across a reload
 *   - Autosave.startNew() — clears canvas and deletes the autosave record
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

function load() {
    const select = { value: '' };
    const sandbox = {
        state: {
            pages: [{ id: 1, elements: [] }], currentPage: 0, pageFormat: 'half-letter',
            meta: { title: '', author: '' }, selectedId: 5, editingId: 5, dragState: {}, resizeState: {}
        },
        document: { getElementById: () => select },
        Date, JSON, Math, Array, Object, Error, parseInt
    };
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(__dirname, 'autosave.js'), 'utf8') + '\nthis.Autosave = Autosave;', sandbox);
    return { sandbox, select };
}

console.log('[serialize → apply round trip]');
{
    const { sandbox, select } = load();
    const { state, Autosave } = sandbox;
    state.pages = [
        { id: 1, elements: [{ id: 7, type: 'text', x: 10, y: 20 }] },
        { id: 2, elements: [], layers: { overlay: [{ id: 8 }] } }
    ];
    state.currentPage = 1;
    state.pageFormat = 'stapled';
    state.meta = { title: 'Uncle Lou', author: 'Us' };
    const snapshot = Autosave.serialize();

    state.pages = [{ id: 1, elements: [] }];
    state.currentPage = 0;
    state.pageFormat = 'half-letter';
    Autosave.apply(JSON.parse(snapshot));

    assert('restores pages and elements', state.pages[0].elements[0].x === 10);
    assert('keeps legacy page.layers', state.pages[1].layers.overlay[0].id === 8);
    assert('restores current page', state.currentPage === 1);
    assert('restores format and syncs the select', state.pageFormat === 'stapled' && select.value === 'stapled');
    assert('restores title/author', state.meta.title === 'Uncle Lou');
    assert('clears selection and edit state', state.selectedId === null && state.editingId === null && state.dragState === null);
    assert('comparable ignores savedAt', Autosave.comparable(snapshot).indexOf('savedAt') === -1);
}

console.log('[apply sanitizes bad input]');
{
    const { sandbox } = load();
    const { state, Autosave } = sandbox;
    Autosave.apply({ app: 'zine-workshop', pages: [{ id: 1 }], currentPage: 99, pageFormat: 'poster' });
    assert('clamps current page', state.currentPage === 0);
    assert('falls back to half-letter format', state.pageFormat === 'half-letter');
    assert('fills missing elements array', Array.isArray(state.pages[0].elements));

    let threw = 0;
    for (const bad of [null, {}, { app: 'ziner', pages: [{}] }, { app: 'zine-workshop', pages: [] }]) {
        try { Autosave.apply(bad); } catch (e) { threw++; }
    }
    assert('rejects non-autosave data', threw === 4);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
