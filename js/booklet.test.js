/**
 * booklet.test.js — Node.js test for the pure booklet logic in booklet.js.
 * No DOM required.
 */

'use strict';

const B = require('./booklet.js');

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}

let nextId = 1000;
const newId = () => nextId++;
const inside = n => Array.from({ length: n }, (_, i) => ({ id: i + 1, role: 'inside', elements: [] }));
const fmt = slot => slot === null ? '-' : slot === 'addendum' ? 'A' : typeof slot === 'number' ? String(slot + 1) : slot;
const sheetRows = sheets => sheets.map(s => `${fmt(s.front[0])}|${fmt(s.front[1])} ${fmt(s.back[0])}|${fmt(s.back[1])}`);

console.log('[makeBookletPages]');
{
    const pages = B.makeBookletPages(newId);
    assert('four pages in role order', pages.map(p => p.role).join() === 'front-cover,their-info,inside,back-cover');
    assert('each has its own id and empty elements', new Set(pages.map(p => p.id)).size === 4 && pages.every(p => p.elements.length === 0));
}

console.log('[labels]');
{
    const pages = B.makeBookletPages(newId);
    pages.splice(3, 0, { id: newId(), role: 'inside', elements: [] });
    assert('cover and info labels', B.pageLabel(pages, 0) === 'Front cover' && B.pageLabel(pages, 1) === 'Your info' && B.pageLabel(pages, 4) === 'Back cover');
    assert('inside pages are numbered from 1', B.pageLabel(pages, 2) === 'Page 1' && B.pageLabel(pages, 3) === 'Page 2');
    assert('pages without a role use their position', B.pageLabel([{}, {}], 1) === 'Page 2');
    assert('slot labels', B.slotLabel(0) === 'Page 1' && B.slotLabel('glenn-info') === "Glenn's info" && B.slotLabel(null) === 'Blank' && B.slotLabel('back-cover') === 'Back cover');
    assert('addendum label', B.slotLabel('addendum') === 'Addendum');
    assert('insideIndexes', B.insideIndexes(pages).join() === '2,3');
    assert('slotPageIndex for roles and inside numbers', B.slotPageIndex(pages, 'their-info') === 1 && B.slotPageIndex(pages, 1) === 3);
    assert('slotPageIndex is null for Glenn and blanks', B.slotPageIndex(pages, 'glenn-info') === null && B.slotPageIndex(pages, null) === null);
}

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

console.log('[sidesInPrintOrder]');
{
    const sheets = B.bookletSheets(7);
    const order = mode => B.sidesInPrintOrder(sheets, mode).map(s => s.sheet + s.side[0]).join();
    assert('duplex alternates front/back per sheet', order('duplex') === '1f,1b,2f,2b,3f,3b');
    assert('two-pass prints all fronts then all backs', order('two-pass') === '1f,2f,3f,1b,2b,3b');
    assert('sides carry their slots', B.sidesInPrintOrder(sheets, 'duplex')[1].slots.join() === 'their-info,glenn-info');
}

console.log('[migrateBookletPages]');
{
    const legacy = [{ id: 1, elements: [{ id: 9 }] }, { id: 2, elements: [] }];
    const { pages, dropped } = B.migrateBookletPages(legacy, newId);
    assert('roleless pages become inside pages, in order', pages.map(p => p.role).join() === 'front-cover,their-info,inside,inside,back-cover');
    assert('content kept', pages[2].elements[0].id === 9 && pages[3].id === 2);
    assert('nothing dropped', dropped === 0);

    const tooMany = B.migrateBookletPages(inside(30), newId);
    assert('keeps the first 24 inside pages', B.insideIndexes(tooMany.pages).length === 24 && tooMany.pages[2].id === 1);
    assert('reports 6 dropped', tooMany.dropped === 6);
    assert('limits: 23 to add, 24 kept on load', B.MAX_INSIDE_PAGES === 23 && B.MAX_STORED_INSIDE_PAGES === 24);
    assert('a saved 24-page project loads intact', B.insideIndexes(B.migrateBookletPages(inside(24), newId).pages).length === 24);

    const already = B.makeBookletPages(newId);
    const again = B.migrateBookletPages(already, newId);
    assert('already-migrated pages keep their ids', again.pages.map(p => p.id).join() === already.map(p => p.id).join());

    const empty = B.migrateBookletPages([], newId);
    assert('no pages gets one blank inside page', B.insideIndexes(empty.pages).length === 1);
}

console.log('[migrateBookletState keeps the page on screen]');
{
    const legacy = [{ id: 1, elements: [] }, { id: 2, elements: [] }, { id: 3, elements: [] }];
    const m = B.migrateBookletState(legacy, 1, newId);
    assert('old page 2 is now at index 3', m.currentPage === 3 && m.pages[3].id === 2);
    const gone = B.migrateBookletState(inside(30), 29, newId);
    assert('a dropped current page falls back to 0', gone.currentPage === 0);
}

console.log('[infoFormLayout]');
{
    const specs = B.infoFormLayout({ name: 'Ana', contact: '', date: '1 Oct', note: 'hello' });
    assert('one spec per filled field, in field order', specs.map(s => s.field).join() === 'name,date,note');
    assert('stacked top-down inside the margins', specs.every((s, i) => s.x >= 24 && s.x + s.w <= 504 && (i === 0 || s.y > specs[i - 1].y)));
    assert('name is bold', specs[0].bold === true && specs[0].content === 'Ana');
    assert('blank and missing fields give nothing', B.infoFormLayout({ name: '  ' }).length === 0 && B.infoFormLayout(undefined).length === 0);
}

console.log('[infoFormLayout after Randomize]');
{
    const note = "I forewent my creativity to an algorithm and all I got was this zine! Maybe I edited it along the way...";
    assert('the randomized note text is fixed', B.RANDOMIZED_NOTE === note);
    const specs = B.infoFormLayout({ randomized: true, name: 'Ana', note: 'my own words' });
    const noteSpec = specs.find(s => s.field === 'note');
    assert('randomized: note is always the fixed text and locked', noteSpec && noteSpec.content === note && noteSpec.locked === true);
    assert('randomized: other fields are not locked', specs.filter(s => s.field !== 'note').every(s => !s.locked));
    assert('randomized: note is there even with no other fields', B.infoFormLayout({ randomized: true }).map(s => s.field).join() === 'note');
    assert('not randomized: note is the person\'s own and unlocked',
        B.infoFormLayout({ note: 'mine' }).every(s => s.content === 'mine' && !s.locked));
}

console.log('[replaceInfoFormElements]');
{
    const makeText = spec => ({ id: newId(), content: spec.content, fromInfoForm: true });
    const own = { id: 1, content: 'my doodle' };
    const first = B.replaceInfoFormElements([own], B.infoFormLayout({ name: 'Ana', note: 'x' }), makeText);
    assert('adds form elements after the participant\'s own', first.length === 3 && first[0] === own);
    const second = B.replaceInfoFormElements(first, B.infoFormLayout({ name: 'Bo' }), makeText);
    assert('refilling replaces only form elements', second.length === 2 && second[0] === own && second[1].content === 'Bo');
    const cleared = B.replaceInfoFormElements(second, B.infoFormLayout({}), makeText);
    assert('refilling with every field cleared removes the old form text', cleared.length === 1 && cleared[0] === own);
}

console.log('[importInsidePages]');
{
    const base = B.makeBookletPages(newId);
    const booklet = { name: 'a.json', data: { pageFormat: 'half-letter', pages: [
        { id: 1, role: 'front-cover', elements: [{ id: 5 }] },
        { id: 2, role: 'inside', elements: [{ id: 6, content: 'A1' }] },
        { id: 3, role: 'inside', elements: [{ id: 7, content: 'A2' }], layers: { overlay: [{ id: 8 }] } },
        { id: 4, role: 'back-cover', elements: [] }
    ] } };
    const legacy = { name: 'old.json', data: { pageFormat: 'half-letter', pages: [{ id: 1, elements: [{ id: 6, content: 'L1' }] }] } };
    const sheet = { name: 'sheet.json', data: { pageFormat: 'single-page', pages: [{ id: 1, elements: [] }] } };
    const junk = { name: 'junk.json', data: { hello: 'world' } };

    const r = B.importInsidePages(base, [booklet, sheet, legacy, junk], newId);
    const insideContent = B.insideIndexes(r.pages).map(i => (r.pages[i].elements[0] || {}).content || '');
    assert('appends inside pages after the last inside page, file then page order', insideContent.join() === ',A1,A2,L1');
    assert('back cover stays last', r.pages[r.pages.length - 1].role === 'back-cover');
    assert('covers of imported files ignored', r.pages.filter(p => p.role === 'front-cover').length === 1);
    assert('counts imported pages', r.imported === 3 && r.skipped === 0);
    assert('non-booklet files named as skipped', r.skippedFiles.join() === 'sheet.json,junk.json');
    const ids = r.pages.flatMap(p => [p.id, ...p.elements.map(e => e.id), ...Object.values(p.layers || {}).flat().map(e => e.id)]);
    assert('every page and element id is fresh and unique', new Set(ids).size === ids.length && !ids.includes(6) && !ids.includes(8));
    assert('source data not modified', booklet.data.pages[1].elements[0].id === 6);

    const full = B.migrateBookletPages(inside(22), newId).pages;
    const capped = B.importInsidePages(full, [booklet], newId);
    assert('stops at 23 inside pages', B.insideIndexes(capped.pages).length === 23 && capped.imported === 1 && capped.skipped === 1);

    const ten = B.migrateBookletPages(inside(10), newId).pages;
    const workshop = B.importInsidePages(ten, [booklet], newId, B.WORKSHOP_MAX_INSIDE_PAGES);
    assert('a workshop limit stops at 11 inside pages', B.insideIndexes(workshop.pages).length === 11 && workshop.imported === 1 && workshop.skipped === 1);
}

console.log('[workshop limit: 16 pages in all]');
{
    assert('11 inside pages', B.WORKSHOP_MAX_INSIDE_PAGES === 11);
    const sheets = B.bookletSheets(B.WORKSHOP_MAX_INSIDE_PAGES);
    const slots = sheets.flatMap(s => [...s.front, ...s.back]);
    assert('exactly 4 sheets, 16 pages, no blanks', sheets.length === 4 && slots.length === 16 && !slots.includes(null));
}

console.log('[importInsidePages skips malformed files]');
{
    const base = B.makeBookletPages(newId);
    const good = { name: 'good.json', data: { pageFormat: 'half-letter', pages: [{ id: 1, role: 'inside', elements: [{ id: 2, content: 'G' }] }] } };
    const bad = [
        { name: 'null-page.json', data: { pages: [null] } },
        { name: 'string-elements.json', data: { pages: [{ elements: 'abc' }] } },
        { name: 'null-element.json', data: { pages: [{ elements: [null] }] } },
        { name: 'string-page.json', data: { pages: ['a'] } },
        { name: 'bad-layers.json', data: { pages: [{ elements: [], layers: { overlay: 'x' } }] } }
    ];
    let r, threw = null;
    try { r = B.importInsidePages(base, [bad[0], good, ...bad.slice(1)], newId); } catch (e) { threw = e.message; }
    assert('does not throw (' + threw + ')', threw === null);
    assert('good file still imported', r && r.imported === 1 && B.insideIndexes(r.pages).length === 2);
    assert('every malformed file named', r && r.skippedFiles.join() === bad.map(f => f.name).join());
    assert('no non-object pages added', r && r.pages.every(p => p && typeof p === 'object'));
}

console.log('[importSummary]');
{
    assert('plain', B.importSummary({ imported: 3, skipped: 0, skippedFiles: [] }, []) === 'Imported 3 pages.');
    assert('one page, cap and bad files',
        B.importSummary({ imported: 1, skipped: 2, skippedFiles: ['s.json'] }, ['bad.json']) ===
        'Imported 1 page, skipped 2 (23-page limit). Not imported: s.json, bad.json.');
    assert('names the limit it was given',
        B.importSummary({ imported: 0, skipped: 1, skippedFiles: [] }, [], 11) === 'Imported 0 pages, skipped 1 (11-page limit).');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
