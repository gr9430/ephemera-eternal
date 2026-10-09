// booklet-preview.cjs — Preview modal: reading order and booklet sheets for half-letter.
'use strict';

const { open, assert, done } = require('./harness.cjs');

(async () => {
    const { page, close } = await open();
    await page.evaluate(() => {
        state.pages = makeBookletPages(generateId);
        for (let i = 0; i < 4; i++) state.pages.splice(3, 0, { id: generateId(), role: 'inside', elements: [] });
        render();
    });
    const captions = () => page.$$eval('#preview-pages .preview-page-number', els => els.map(e => e.textContent));

    console.log('[reading order]');
    await page.click('#preview-btn');
    assert('toggle shown for half-letter', !(await page.$eval('#preview-view-toggle', el => el.hidden)));
    assert('reading order: Your info, addendum, Glenn\'s info', (await captions()).join() ===
        "Front cover,Your info,Addendum,Glenn's info,Page 1,Page 2,Page 3,Page 4,Page 5,Back cover");
    assert('the addendum page shows its heading', await page.$eval('#preview-pages .addendum-page', el => el.textContent.includes('About the words in this zine')));

    console.log('[booklet sheets]');
    await page.click('#preview-view-toggle button[data-view="booklet"]');
    const titles = await page.$$eval('#preview-pages .preview-sheet-title', els => els.map(e => e.textContent));
    assert('3 sheets x 2 sides', titles.join() === 'Sheet 1 — front,Sheet 1 — back,Sheet 2 — front,Sheet 2 — back,Sheet 3 — front,Sheet 3 — back');
    assert('halves captioned in print order', (await captions()).join() ===
        "Back cover,Front cover,Your info,Glenn's info,Blank,Addendum,Page 1,Blank,Page 5,Page 2,Page 3,Page 4");
    assert('booklet view stays chosen after reopening', await page.evaluate(() => {
        closeDigitalPreview();
        openDigitalPreview();
        return document.querySelectorAll('#preview-pages .preview-spread').length === 6;
    }));

    console.log('[preview shows text as text]');
    const shown = await page.evaluate(() => {
        const pageEl = buildPreviewPage({ elements: [
            Object.assign(createTextElement(10, 10), { content: '<b>bold?</b> <3 my block' }),
            createImageElement(10, 100, 'x.png" onerror="window.__pwned=1', 'a')
        ] });
        const img = pageEl.querySelector('img');
        return { text: pageEl.textContent, bold: !!pageEl.querySelector('b'), handler: img.getAttribute('onerror'), src: img.getAttribute('src') };
    });
    assert('markup in text is shown literally', shown.text.includes('<b>bold?</b> <3 my block') && !shown.bold);
    assert('image src cannot add attributes', shown.handler === null && shown.src === 'x.png" onerror="window.__pwned=1');

    console.log('[other formats]');
    await page.evaluate(() => closeDigitalPreview());
    await page.selectOption('#page-format', 'single-page');
    await page.click('#preview-btn');
    assert('toggle hidden and plain pages shown', await page.$eval('#preview-view-toggle', el => el.hidden) && (await captions()).join() === 'Page 1');

    await close();
    done();
})();
