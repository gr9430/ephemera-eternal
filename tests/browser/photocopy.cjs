// photocopy.cjs — the Photocopy button (GIMP's Photocopy filter) for photos, clip art and full-page
// photos: Darkness and Sharpness sliders, a processed copy of the picture on the canvas, in the
// Preview and in the PDF, kept through a reload.
'use strict';

const { open, assert, done } = require('./harness.cjs');

(async () => {
    const { page, close } = await open(undefined, '', { welcomeSeen: true });
    await page.waitForFunction(() => state.photoImages.length);

    const place = (make) => page.evaluate(async (make) => {
        const photo = state.photoImages.find(p => p.src.includes('goldman')) || state.photoImages[0];
        state.currentPage = 0;
        const el = eval(make)(photo);
        getCurrentPage().elements = [el];
        state.selectedId = el.id;
        render();
        await Promise.all([...document.querySelectorAll('.canvas-container img')].map(img => img.decode().catch(() => {})));
    }, make.toString());

    // Waits for the canvas picture to be the photocopied copy, then measures it
    const canvasPicture = async (previousSrc = '') => {
        await page.waitForFunction(prev => {
            const img = document.querySelector('.canvas-container img');
            return img && img.src.startsWith('data:') && img.src !== prev && img.complete && getComputedStyle(img).filter === 'none';
        }, previousSrc, { timeout: 20000 });
        return page.$eval('.canvas-container img', img => {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth; c.height = img.naturalHeight;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const d = ctx.getImageData(0, 0, c.width, c.height).data;
            let colour = 0, black = 0, white = 0;
            for (let i = 0; i < d.length; i += 4) {
                colour = Math.max(colour, Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]));
                if (d[i] <= 10) black++;
                if (d[i] >= 245) white++;
            }
            return { src: img.src, colour, black: black / (d.length / 4), white: white / (d.length / 4) };
        });
    };
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
        let max = 0, black = 0;
        for (let i = 0; i < d.length; i += 4) {
            max = Math.max(max, Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]));
            if (d[i] <= 10) black++;
        }
        return { colour: max, black };
    });
    const setSlider = (id, value) => page.$eval(id, (input, value) => {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);

    console.log('[photo: the button and sliders]');
    await place(photo => createImageElement(40, 40, photo.src, ''));
    assert('no sliders in Color', !(await page.$('#prop-darkness')));
    await page.click('.filter-btn:has-text("Photocopy")');
    assert('Photocopy sets the filter', await page.evaluate(() => getCurrentPage().elements[0].filter === 'photocopy'));
    assert('Darkness slider at GIMP\'s 20%', await page.$eval('#prop-darkness', i => i.value === '0.2'));
    assert('Sharpness slider at GIMP\'s 80%', await page.$eval('#prop-sharpness', i => i.value === '0.8'));

    console.log('[photo: the canvas]');
    const first = await canvasPicture();
    assert(`the canvas shows a grey copy (colour ${first.colour})`, first.colour === 0);
    assert(`mostly white, with black in it (white ${(first.white * 100).toFixed(0)}%, black ${(first.black * 100).toFixed(1)}%)`,
        first.white > 0.3 && first.black > 0.003);
    await setSlider('#prop-darkness', '0.8');
    assert('Darkness is kept on the picture', await page.evaluate(() => getCurrentPage().elements[0].photocopyDarkness === 0.8));
    const darker = await canvasPicture(first.src);
    assert(`more darkness, more black (${(first.black * 100).toFixed(1)}% → ${(darker.black * 100).toFixed(1)}%)`, darker.black > first.black);
    await setSlider('#prop-sharpness', '1');
    assert('Sharpness is kept on the picture', await page.evaluate(() => getCurrentPage().elements[0].photocopySharpness === 1));
    const sharper = await canvasPicture(darker.src);
    assert('Sharpness makes a new copy', sharper.src !== darker.src);
    assert('the panel keeps the slider values', await page.$eval('#prop-darkness', i => i.value === '0.8') &&
        await page.$eval('#prop-sharpness', i => i.value === '1'));

    console.log('[photo: the PDF]');
    const pdf = await pdfColour();
    assert(`prints grey, with black in it (colour ${pdf.colour}, ${pdf.black} black pixels)`, pdf.colour <= 8 && pdf.black > 500);

    console.log('[full-page photo]');
    await place(photo => Object.assign(createBackgroundImageElement(photo.src, ''), { opacity: 1 }));
    await page.click('.filter-btn:has-text("Photocopy")');
    const bg = await canvasPicture();
    assert('the canvas shows a grey copy', bg.colour === 0);
    await page.click('#preview-btn');
    await page.waitForFunction(() => {
        const img = document.querySelector('#preview-pages img');
        return img && img.src.startsWith('data:');
    }, null, { timeout: 20000 });
    assert('the Preview shows it', true);
    await page.click('#preview-close');
    const bgPdf = await pdfColour();
    assert(`and the PDF prints it (colour ${bgPdf.colour})`, bgPdf.colour <= 8 && bgPdf.black > 500);

    console.log('[reload]');
    await page.evaluate(() => Autosave.flush());
    await page.reload();
    await page.waitForFunction(() => typeof Autosave !== 'undefined' && Autosave.enabled && state.pages.length);
    assert('the filter survives a reload', await page.evaluate(() => state.pages[state.currentPage].elements.some(e => e.filter === 'photocopy')));
    await page.evaluate(() => { state.currentPage = 0; render(); });
    await canvasPicture();
    assert('and the copy is made again', true);

    await close();
    done();
})();
