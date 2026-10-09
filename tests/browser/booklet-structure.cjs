// booklet-structure.cjs — half-letter tabs, adding/removing pages, the 23-page cap.
'use strict';

const { open, assert, done } = require('./harness.cjs');

(async () => {
    const { page, close } = await open();
    const tabs = () => page.$$eval('.page-tab', els => els.map(e => e.textContent));
    const disabled = id => page.$eval('#' + id, el => el.disabled);

    console.log('[new half-letter zine]');
    assert('format label renamed', (await page.$eval('#page-format option[value="half-letter"]', o => o.textContent)).startsWith('Half-Letter Booklet'));
    assert('tabs are covers, info and page 1', (await tabs()).join() === 'Front cover,Your info,Page 1,Back cover');
    assert('cannot remove a cover', await disabled('remove-page-btn'));

    console.log('[adding and removing inside pages]');
    await page.click('.page-tab[data-page="2"]');
    await page.click('#add-page-btn');
    assert('new page inserted after the current inside page', (await tabs()).join() === 'Front cover,Your info,Page 1,Page 2,Back cover');
    assert('new page is on screen', await page.evaluate(() => state.currentPage === 3));
    await page.click('.page-tab[data-page="0"]');
    await page.click('#add-page-btn');
    assert('from a cover tab, inserts after the last inside page', (await tabs()).join() === 'Front cover,Your info,Page 1,Page 2,Page 3,Back cover');
    await page.click('#remove-page-btn');
    assert('remove takes out the current inside page', (await tabs()).length === 5);

    console.log('[23-page cap]');
    for (let i = 0; i < 30; i++) {
        if (await disabled('add-page-btn')) break;
        await page.click('#add-page-btn');
    }
    assert('stops at 23 inside pages', await page.evaluate(() => insideIndexes(state.pages).length === 23));
    assert('+ Page disabled at the cap', await disabled('add-page-btn'));

    console.log('[switching formats]');
    await page.selectOption('#page-format', 'single-page');
    assert('single-page tabs unchanged', (await tabs()).join() === 'Page 1');
    await page.selectOption('#page-format', 'half-letter');
    assert('back to a fresh booklet', (await tabs()).join() === 'Front cover,Your info,Page 1,Back cover');

    console.log('[restoring an autosave with more than 24 pages]');
    await page.evaluate(async () => {
        const pages = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, elements: [Object.assign(createTextElement(60, 60), { content: 'P' + (i + 1) })] }));
        Autosave.enabled = false;   // keep the running page from overwriting the seeded save
        await Autosave.request('readwrite', store => store.put(JSON.stringify({ app: 'zine-workshop', version: 1, pageFormat: 'half-letter', currentPage: 0, meta: {}, pages }), 'current'));
    });
    await page.reload();
    await page.waitForFunction(() => typeof Autosave !== 'undefined' && Autosave.enabled && document.getElementById('save-notice'));
    const notice = await page.$eval('#save-notice', n => n.textContent);
    assert('restore notice says pages were dropped (' + notice.slice(0, 60) + '…)', notice.includes('6 pages beyond the 24-page limit'));
    assert('and still says the zine was restored', notice.includes('restored'));

    console.log('[a saved 24-page zine restores whole]');
    await page.evaluate(async () => {
        const pages = Array.from({ length: 24 }, (_, i) => ({ id: i + 1, role: 'inside', elements: [] }));
        Autosave.enabled = false;
        await Autosave.request('readwrite', store => store.put(JSON.stringify({ app: 'zine-workshop', version: 1, pageFormat: 'half-letter', currentPage: 0, meta: {}, pages }), 'current'));
    });
    await page.reload();
    await page.waitForFunction(() => typeof Autosave !== 'undefined' && Autosave.enabled);
    assert('all 24 inside pages come back', await page.evaluate(() => insideIndexes(state.pages).length === 24));

    await close();
    done();
})();
