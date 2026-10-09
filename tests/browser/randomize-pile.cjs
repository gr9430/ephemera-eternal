// randomize-pile.cjs — Randomize on a poster: the pile dialog, piles are added on top (nothing
// replaced), Cancel and Escape add nothing, and booklets keep the old Randomize.
'use strict';

const { open, assert, done } = require('./harness.cjs');

(async () => {
    const { page, close } = await open();
    await page.waitForFunction(() => state.grammar.slogan && state.clipartImages.length && state.photoImages.length);
    await page.selectOption('#page-format', 'poster-letter');
    await page.evaluate(() => addElement(Object.assign(createTextElement(100, 100), { content: 'mine' })));
    const shown = id => page.$eval('#' + id, m => m.classList.contains('show'));
    const count = () => page.evaluate(() => getCurrentPage().elements.length);

    console.log('[dialog]');
    await page.click('#randomize-btn');
    assert('pile dialog, not the booklet confirm', await shown('randomize-pile-modal') && !(await shown('randomize-confirm-modal')));
    await page.click('#randomize-pile-modal button[data-pile=""]');
    assert('Cancel closes and adds nothing', !(await shown('randomize-pile-modal')) && await count() === 1);
    await page.click('#randomize-btn');
    await page.keyboard.press('Escape');
    assert('Escape closes and adds nothing', !(await shown('randomize-pile-modal')) && await count() === 1);

    console.log('[protest pile]');
    await page.click('#randomize-btn');
    await page.click('#randomize-pile-modal button[data-pile="protest"]');
    const first = await page.evaluate(() => ({ format: state.pageFormat, els: getCurrentPage().elements.map(e => ({ id: e.id, type: e.type, content: e.content })) }));
    assert('still a poster', first.format === 'poster-letter');
    assert('own element kept, still at the bottom', first.els[0].content === 'mine');
    assert('pictures and text added', first.els.length >= 6 && first.els.some(e => e.type === 'image') && first.els.some(e => e.type === 'text' && e.content !== 'mine'));
    assert('every item is a normal element on the canvas', await page.evaluate(() =>
        getCurrentPage().elements.every(e => document.querySelector(`[data-element-id="${e.id}"]`) && !e.locked)));

    console.log('[show flyer pile on top]');
    await page.click('#randomize-btn');
    await page.click('#randomize-pile-modal button[data-pile="show-flyer"]');
    const second = await page.evaluate(() => getCurrentPage().elements.map(e => e.id));
    assert('earlier elements kept in order', first.els.every((e, i) => second[i] === e.id));
    assert('more added', second.length > first.els.length);

    console.log('[booklets keep the old Randomize]');
    await page.selectOption('#page-format', 'half-letter');   // harness accepts the confirm
    await page.click('#randomize-btn');
    assert('booklet gets the confirm dialog', await shown('randomize-confirm-modal') && !(await shown('randomize-pile-modal')));
    await page.click('#randomize-no-btn');

    await close();
    done();
})();
