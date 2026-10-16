// randomize.cjs — the Randomize button: confirm dialog, the random 23-page booklet,
// the IBM dialog, autosave, and opening-night mode leaving both covers alone.
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
        theirInfo: state.pages.find(p => p.role === 'their-info').elements.map(e => ({ content: e.content, locked: e.locked === true })),
        flyers: state.pages.some(p => p.elements.some(e => String(e.src || '').includes('images/flyers/'))),
        title: state.pages[0].elements.some(e => e.content === 'Ephemera Eternal'),
        layoutLeft: state.pages.some(p => 'layout' in p),
        placeholders: state.pages.some(p => p.elements.some(e => /\[\w+\]/.test(e.content || '')))
    }));
    assert('switched to half-letter, select follows', after.format === 'half-letter' && after.select === 'half-letter');
    assert('26 pages: front cover, Your info, 23 inside, back cover', after.roles.length === 26 &&
        after.roles[0] === 'front-cover' && after.roles[1] === 'their-info' && after.roles[25] === 'back-cover' &&
        after.roles.filter(r => r === 'inside').length === 23);
    assert('view rotation back to 0', after.rotation === 0);
    const NOTE = 'I forewent my creativity to an algorithm and all I got was this zine! Maybe I edited it along the way...';
    assert('form cleared down to the randomized flag', after.info === '{"randomized":true}');
    assert('Your info holds only the locked note, with the exact text', after.theirInfo.length === 1 &&
        after.theirInfo[0].content === NOTE && after.theirInfo[0].locked);
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

    console.log('[the note is locked]');
    const noteBox = await page.$eval('#info-note', el => ({ value: el.value, readOnly: el.readOnly }));
    assert('form Note box shows the note, read-only', noteBox.value === NOTE && noteBox.readOnly);
    await page.evaluate(() => {   // even a scripted input event can't change it
        const box = document.getElementById('info-note');
        box.value = 'changed';
        box.dispatchEvent(new Event('input'));
    });
    assert('typing into it changes nothing', await page.evaluate(() => state.meta.info.note === undefined || state.meta.info.note === ''));
    const noteId = await page.evaluate(() => getCurrentPage().elements.find(e => e.locked).id);
    const center = await page.$eval(`[data-element-id="${noteId}"]`, el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 20 }; });
    await page.mouse.click(center.x, center.y);
    assert('clicking the note does not select it', await page.evaluate(id => state.selectedId !== id, noteId));
    await page.mouse.dblclick(center.x, center.y);
    assert('double-clicking the note does not start editing it', await page.evaluate(id => state.editingId !== id, noteId));
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + 80, center.y + 80);
    await page.mouse.up();
    assert('dragging does not move it', await page.evaluate(id => { const e = getCurrentPage().elements.find(el => el.id === id); return e.x === 48 && e.y === 48; }, noteId));
    const selectBtn = await page.$(`.check-select[data-element-id="${noteId}"]`);
    if (selectBtn) await selectBtn.click();
    assert('the accessibility Select button skips it', await page.evaluate(id => state.selectedId !== id, noteId));
    await page.keyboard.press('Delete');
    assert('still there after Delete', await page.evaluate(id => getCurrentPage().elements.some(e => e.id === id), noteId));

    await page.fill('#info-name', 'Ana');
    await page.click('#info-fill-btn');
    const filled = await page.evaluate(() => getCurrentPage().elements.map(e => ({ content: e.content, locked: e.locked === true })));
    assert('Fill in page adds the name and keeps the note locked, same text',
        filled.some(e => e.content === 'Ana' && !e.locked) && filled.filter(e => e.locked).length === 1 &&
        filled.find(e => e.locked).content === NOTE);

    console.log('[Escape on the IBM dialog acts as OK]');
    await page.click('.page-tab[data-page="0"]');
    await page.click('#randomize-btn');
    await page.click('#randomize-yes-btn');
    await page.keyboard.press('Escape');
    assert('closed and on Your info', !(await shown(page, 'randomize-done-modal')) &&
        await page.evaluate(() => getCurrentPage().role === 'their-info'));

    console.log('[rendered text fits its box]');
    // Text taller than its box spills off slogan strips and runs into the next poem line
    const spills = await page.evaluate(async () => {
        await document.fonts.ready;
        const found = [];
        for (let run = 0; run < 4; run++) {
            Randomize.apply();
            for (let i = 0; i < state.pages.length; i++) {
                state.currentPage = i;
                render();
                document.querySelectorAll('.zine-element .zine-text').forEach(text => {
                    const box = text.parentElement;
                    if (text.offsetHeight > box.clientHeight + 2) found.push(`${pageLabel(state.pages, i)}: "${text.textContent.slice(0, 30)}" ${text.offsetHeight}>${box.clientHeight}`);
                });
            }
        }
        return found;
    });
    assert('no text spills past its box (' + spills.slice(0, 3).join('; ') + ')', spills.length === 0);
    await page.evaluate(() => { Randomize.apply(); Randomize.finish(); });

    console.log('[New removes the lock]');
    await page.click('#new-zine-btn');
    await page.waitForFunction(() => !(state.meta.info && state.meta.info.randomized));
    await page.click('.page-tab[data-page="1"]');
    assert('note box editable again after New', await page.$eval('#info-note', el => !el.readOnly && el.value === ''));
    await page.click('#randomize-btn');
    await page.click('#randomize-yes-btn');
    await page.click('#randomize-ok-btn');

    console.log('[autosave]');
    const firstText = await page.evaluate(async () => {
        await Autosave.flush();
        return JSON.stringify(state.pages[2].elements.map(e => e.content || e.src));
    });
    await page.reload();
    await page.waitForFunction(() => typeof Autosave !== 'undefined' && Autosave.enabled);
    assert('reload brings back the randomized zine', await page.evaluate(first =>
        state.pages.length === 26 && JSON.stringify(state.pages[2].elements.map(e => e.content || e.src)) === first, firstText));
    await session.close();

    console.log('[?opening-night leaves both covers alone]');
    session = await open(undefined, '?workshop&opening-night');
    page = session.page;
    await dataLoaded(page);
    const backBefore = await page.evaluate(() => {
        const back = state.pages.find(p => p.role === 'back-cover');
        back.elements.push(Object.assign(createTextElement(60, 60), { content: 'my back cover' }));
        const front = state.pages.find(p => p.role === 'front-cover');
        front.elements.push(Object.assign(createTextElement(60, 60), { content: 'my front cover' }));
        return { back: JSON.stringify(back), front: JSON.stringify(front) };
    });
    await page.click('#randomize-btn');
    await page.click('#randomize-yes-btn');
    await page.click('#randomize-ok-btn');
    const night = await page.evaluate(() => ({
        back: JSON.stringify(state.pages.find(p => p.role === 'back-cover')),
        front: JSON.stringify(state.pages.find(p => p.role === 'front-cover')),
        count: state.pages.length,
        insideFilled: state.pages.filter(p => p.role === 'inside').every(p => p.elements.length > 0)
    }));
    assert('back cover page carried over untouched', night.back === backBefore.back);
    assert('front cover page carried over untouched', night.front === backBefore.front);
    assert('the rest is randomized', night.count === 26 && night.insideFilled);

    await session.close();
    done();
})();
