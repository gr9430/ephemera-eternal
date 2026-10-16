// black-and-white.cjs — photos, clip art and full-page photos can be shown in Color, Black & white
// or High contrast with buttons in the properties panel, and the PDF prints them the way the screen
// shows them (html2canvas ignores CSS filter, so the capture must bake the filter into the picture).
'use strict';

const { open, assert, done } = require('./harness.cjs');

(async () => {
    const { page, close } = await open(undefined, '', { welcomeSeen: true });
    await page.waitForFunction(() => state.photoImages.length);

    // Put one picture on an empty first page, select it, and wait for it to load
    const place = (make) => page.evaluate(async (make) => {
        const photo = state.photoImages.find(p => p.src.includes('goldman')) || state.photoImages[0];
        state.currentPage = 0;
        const el = eval(make)(photo);
        getCurrentPage().elements = [el];
        state.selectedId = el.id;
        render();
        await Promise.all([...document.querySelectorAll('.canvas-container img')].map(img => img.decode().catch(() => {})));
        return el.id;
    }, make.toString());

    const pressed = () => page.$$eval('.filter-btn', bs => bs.filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent.trim()));
    const canvasFilter = () => page.$eval('.canvas-container img', img => getComputedStyle(img).filter);
    // Largest gap between a pixel's strongest and weakest channel in the PDF capture: 0 is pure grey
    // (deselected and without guides, as Save as PDF does; the paper itself is 8 off grey)
    const pdfColour = () => page.evaluate(async () => {
        const selected = state.selectedId;
        state.selectedId = null;
        render();
        document.querySelector('.canvas-container').classList.add('hide-guides');
        const canvas = await captureEditorPage(0);
        document.querySelector('.canvas-container').classList.remove('hide-guides');
        state.selectedId = selected;
        render();
        const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let max = 0;
        for (let i = 0; i < d.length; i += 4) max = Math.max(max, Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]));
        return max;
    });

    console.log('[photo: the buttons]');
    await place(photo => createImageElement(40, 40, photo.src, ''));
    assert('Color, Black & white, High contrast and Photocopy buttons', (await page.$$eval('.filter-btn', bs => bs.map(b => b.textContent.trim()))).join('|') ===
        'Color|Black & white|High contrast|Photocopy');
    assert('a new photo is in Color', (await pressed()).join() === 'Color');
    const colour = await pdfColour();
    assert(`a colour photo prints in colour (${colour})`, colour > 60);
    await page.click('.filter-btn:has-text("Black & white")');
    assert('Black & white sets the filter', await page.evaluate(() => getCurrentPage().elements[0].filter === 'grayscale(1)'));
    assert('and the button shows it', (await pressed()).join() === 'Black & white');
    assert('the canvas shows it', (await canvasFilter()) === 'grayscale(1)');

    console.log('[photo: the PDF]');
    const bw = await pdfColour();
    assert(`a black & white photo prints in black & white (${bw})`, bw <= 8);
    assert('the editor gets its own picture back', await page.$eval('.canvas-container img', img =>
        !img.src.startsWith('data:') && getComputedStyle(img).filter === 'grayscale(1)'));
    await page.click('.filter-btn:has-text("High contrast")');
    assert('High contrast sets the filter', await page.evaluate(() => getCurrentPage().elements[0].filter === 'contrast(2) grayscale(1)'));
    const hc = await pdfColour();
    assert(`a high-contrast photo prints in black & white (${hc})`, hc <= 8);
    await page.click('.filter-btn:has-text("Color")');
    assert('Color takes the filter off', await page.evaluate(() => getCurrentPage().elements[0].filter === 'none') &&
        (await canvasFilter()) === 'none');

    console.log('[full-page photo]');
    await place(photo => Object.assign(createBackgroundImageElement(photo.src, ''), { opacity: 1 }));
    assert('has the buttons too, in Color', (await pressed()).join() === 'Color');
    await page.click('.filter-btn:has-text("Black & white")');
    assert('the canvas shows it', (await canvasFilter()) === 'grayscale(1)');
    const bg = await pdfColour();
    assert(`and the PDF prints it in black & white (${bg})`, bg <= 8);
    await page.click('#preview-btn');
    assert('the Preview shows it', await page.$eval('#preview-pages img', img => getComputedStyle(img).filter === 'grayscale(1)'));
    await page.click('#preview-close');

    await close();
    done();
})();
