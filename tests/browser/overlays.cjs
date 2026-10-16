// overlays.cjs — the Overlays panel is built from data/overlays.json: one thumbnail per overlay,
// labelled, and clicking one lays it over the whole page at its own blend mode and opacity.
'use strict';

const { open, assert, done } = require('./harness.cjs');

(async () => {
    const { page, close } = await open(undefined, '', { welcomeSeen: true });
    await page.waitForFunction(() => state.overlays.length && state.photoImages.length);

    console.log('[the panel]');
    const listed = await page.evaluate(() => state.overlays.length);
    const items = await page.$$eval('#overlay-gallery .overlay-item', els => els.map(e => e.textContent.trim()));
    assert(`one thumbnail per overlay (${items.length} of ${listed})`, items.length === listed && listed === 11);
    assert(`labelled: ${items.join(', ')}`, items[0] === 'Grit 1' && items.includes('White wash'));
    assert('white overlays sit on grey so they can be seen', await page.$eval('[data-overlay-id="tl_paper_338"]', el =>
        getComputedStyle(el).backgroundColor === 'rgb(85, 85, 85)'));

    console.log('[placing]');
    await page.evaluate(() => { state.currentPage = 0; getCurrentPage().elements = []; render(); });
    await page.click('[data-overlay-id="tl_paper_248"]');
    const specks = await page.evaluate(() => getCurrentPage().elements.slice(-1)[0]);
    const { w, h } = await page.evaluate(() => sheetSize());
    assert('Specks covers the page', specks.type === 'texture' && specks.x === 0 && specks.y === 0 && specks.w === w && specks.h === h);
    assert('at its own blend and opacity: multiply, 60%', specks.src === 'overlays/Texturelabs_Paper_248L.png' && specks.blendMode === 'multiply' && specks.opacity === 0.6);
    assert('with its alt text', specks.alt === 'overlay: scattered fine black specks');
    await page.click('[data-overlay-id="tl_paper_338"]');
    const wash = await page.evaluate(() => getCurrentPage().elements.slice(-1)[0]);
    assert('White wash is placed at normal blend, 70%', wash.blendMode === 'normal' && wash.opacity === 0.7);
    assert('and shows that way on the canvas', await page.evaluate(() =>
        getComputedStyle([...document.querySelectorAll('.canvas-container .zine-texture')].pop().parentElement).mixBlendMode === 'normal'));

    console.log('[the PDF]');
    const dark = await page.evaluate(async () => {
        state.selectedId = null; render();
        document.querySelector('.canvas-container').classList.add('hide-guides');
        const canvas = await captureEditorPage(0);
        document.querySelector('.canvas-container').classList.remove('hide-guides');
        const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] < 200) n++;
        return n;
    });
    assert(`the overlays print (${dark} darker pixels)`, dark > 100);

    await close();
    done();
})();
