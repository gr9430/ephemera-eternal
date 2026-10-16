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
    const pressed = () => page.$$eval('.filter-btn', bs => bs.filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent.trim()));
    const setSlider = (id, value) => page.$eval(id, (input, value) => {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);

    console.log('[photo: the button and sliders]');
    await place(photo => createImageElement(40, 40, photo.src, ''));
    assert('no sliders in Color', !(await page.$('#prop-maskradius')));
    await page.click('.filter-btn:has-text("Photocopy")');
    assert('Photocopy sets the filter', await page.evaluate(() => getCurrentPage().elements[0].filter === 'photocopy'));
    const sliders = () => page.$$eval('.property-group input[type=range]', inputs => inputs
        .filter(i => ['prop-maskradius', 'prop-sharpness', 'prop-black', 'prop-white', 'prop-solid', 'prop-dots', 'prop-bold'].includes(i.id))
        .map(i => `${i.previousElementSibling.textContent} ${i.value} (${i.nextElementSibling.textContent})`).join(', '));
    const shown = await sliders();
    assert(`GIMP 3's four sliders at the zines' settings, then the shadow fills and Bold lines: ${shown}`, shown ===
        'Mask radius 16 (16.0), Sharpness 0.5 (0.50), Percent black 0 (0.00), Percent white 1 (1.00), Solid black 0 (Off), Toner dots 0.5 (0.50), Bold lines 1 (1)');

    console.log('[photo: the canvas]');
    const first = await canvasPicture();
    assert(`the canvas shows a grey copy (colour ${first.colour})`, first.colour === 0);
    assert(`pure black and white (white ${(first.white * 100).toFixed(0)}%, black ${(first.black * 100).toFixed(1)}%)`,
        first.white + first.black > 0.999 && first.black > 0.01);
    await setSlider('#prop-maskradius', '40');
    assert('Mask radius is kept on the picture', await page.evaluate(() => getCurrentPage().elements[0].photocopyMaskRadius === 40));
    const wider = await canvasPicture(first.src);
    assert(`a bigger mask radius, more black (${(first.black * 100).toFixed(1)}% → ${(wider.black * 100).toFixed(1)}%)`, wider.black > first.black);
    await setSlider('#prop-sharpness', '0.9');
    assert('Sharpness is kept on the picture', await page.evaluate(() => getCurrentPage().elements[0].photocopySharpness === 0.9));
    const sharper = await canvasPicture(wider.src);
    assert('Sharpness makes a new copy', sharper.src !== wider.src);
    await setSlider('#prop-black', '0.3');
    assert('Percent black is kept on the picture', await page.evaluate(() => getCurrentPage().elements[0].photocopyBlack === 0.3));
    const softened = await canvasPicture(sharper.src);
    assert(`Percent black above 0 brings in greys (${((1 - softened.white - softened.black) * 100).toFixed(0)}%)`,
        softened.white + softened.black < 0.99);
    await setSlider('#prop-white', '0.5');
    assert('Percent white is kept on the picture', await page.evaluate(() => getCurrentPage().elements[0].photocopyWhite === 0.5));
    const whitened0 = await canvasPicture(softened.src);
    await setSlider('#prop-bold', '2');
    assert('Bold lines is kept on the picture', await page.evaluate(() => getCurrentPage().elements[0].photocopyBold === 2));
    const whitened = await canvasPicture(whitened0.src);
    assert(`the panel keeps the values: ${await sliders()}`, (await sliders()) ===
        'Mask radius 40 (40.0), Sharpness 0.9 (0.90), Percent black 0.3 (0.30), Percent white 0.5 (0.50), Solid black 0 (Off), Toner dots 0.5 (0.50), Bold lines 2 (2)');

    console.log('[the same as GIMP]');
    // tests/browser/fixtures/gimp-photocopy-goldman.png: GIMP 3.2's Photocopy on this photo at mask
    // radius 16, sharpness 0.5, black 0, white 1 (shadow fills off: they aren't GIMP's). A few
    // strokes' edges land a pixel apart; 1.1% of pixels differed when this was written.
    const fixture = 'data:image/png;base64,' + require('fs').readFileSync(require('path').join(__dirname, 'fixtures', 'gimp-photocopy-goldman.png')).toString('base64');
    const off = await page.evaluate(async fixture => {
        const load = async src => { const img = new Image(); img.src = src; await img.decode(); return img; };
        const ours = await load(await Photocopy.make('images/goldman/8oypB8Nw.jpeg', Object.assign({}, PHOTOCOPY_DEFAULTS, { solid: 0, dots: 0, bold: 0 })).promise);
        const gimp = await load(fixture);
        const read = img => {
            const c = document.createElement('canvas');
            c.width = gimp.naturalWidth; c.height = gimp.naturalHeight;
            c.getContext('2d').drawImage(img, 0, 0);
            return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        };
        const a = read(ours), b = read(gimp);
        let n = 0;
        for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 64) n++;
        return n / (a.length / 4);
    }, fixture);
    assert(`matches GIMP's own Photocopy (${(off * 100).toFixed(2)}% of pixels differ)`, off < 0.02);

    console.log('[a dark face stays dark]');
    // images/goldman/sEBmMTkQ.jpeg: a mural of a Black man's face. GIMP's Photocopy only draws edges,
    // so his skin comes out white; the Toner dots (on by default) keep it dark.
    const face = await page.evaluate(async () => {
        const darkness = async settings => {
            const img = new Image();
            img.src = await Photocopy.make('images/goldman/sEBmMTkQ.jpeg', Object.assign({}, PHOTOCOPY_DEFAULTS, settings)).promise;
            await img.decode();
            const c = document.createElement('canvas');
            c.width = img.naturalWidth; c.height = img.naturalHeight;
            c.getContext('2d').drawImage(img, 0, 0);
            let black = 0, n = 0;
            for (const [x0, y0, x1, y1] of [[0.37, 0.70, 0.43, 0.80], [0.55, 0.70, 0.61, 0.80], [0.42, 0.55, 0.56, 0.60]]) {   // cheeks, forehead
                const d = c.getContext('2d').getImageData(x0 * c.width, y0 * c.height, (x1 - x0) * c.width, (y1 - y0) * c.height).data;
                for (let i = 0; i < d.length; i += 4) { n++; if (d[i] < 128) black++; }
            }
            return black / n;
        };
        return { gimp: await darkness({ solid: 0, dots: 0 }), dots: await darkness({}), solid: await darkness({ solid: 0.45, dots: 0 }) };
    });
    assert(`with both fills off (GIMP's look) the face washes out (${(face.gimp * 100).toFixed(0)}% dark)`, face.gimp < 0.05);
    assert(`Toner dots keep it dark (${(face.dots * 100).toFixed(0)}% dark)`, face.dots > 0.35);
    assert(`so does Solid black (${(face.solid * 100).toFixed(0)}% dark)`, face.solid > 0.35);

    console.log('[photo: the PDF]');
    await setSlider('#prop-black', '0');   // back to solid black
    await canvasPicture(whitened.src);
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

    console.log('[Apply: copy the copy]');
    await page.waitForFunction(() => state.photoImages.length);
    await place(photo => createImageElement(40, 40, photo.src, ''));
    const original = await page.evaluate(() => getCurrentPage().elements[0].src);
    assert('no Apply button in Color', !(await page.$('#prop-photocopy-apply')));
    await page.click('.filter-btn:has-text("Photocopy")');
    const gen1 = await canvasPicture();
    await page.click('#prop-photocopy-apply');
    await page.waitForFunction(() => getCurrentPage().elements[0].src.startsWith('data:'), null, { timeout: 20000 });
    const applied = await page.evaluate(() => {
        const el = getCurrentPage().elements[0];
        return { src: el.src, filter: el.filter, originalSrc: el.originalSrc, copies: el.photocopyCopies };
    });
    assert('Apply makes the copy the picture', applied.src === gen1.src);
    assert('and shows it as it is (no filter on top)', applied.filter === 'none' && (await pressed()).join() === 'Color');
    assert('the original is kept, and the copy counted', applied.originalSrc === original && applied.copies === 1);
    assert('the canvas shows the applied copy', await page.$eval('.canvas-container img', img => img.src) === applied.src);
    const appliedPdf = await pdfColour();
    assert(`the PDF prints it (colour ${appliedPdf.colour}, ${appliedPdf.black} black pixels)`, appliedPdf.colour <= 8 && appliedPdf.black > 500);
    await page.click('.filter-btn:has-text("Photocopy")');
    const gen2 = await canvasPicture(applied.src);
    assert(`Photocopy again copies the copy (black ${(gen1.black * 100).toFixed(1)}% → ${(gen2.black * 100).toFixed(1)}%)`, gen2.src !== gen1.src);
    await page.click('#prop-photocopy-apply');
    await page.waitForFunction(src => getCurrentPage().elements[0].src !== src, applied.src, { timeout: 20000 });
    assert('Apply again: two copies, the original still kept', await page.evaluate(original => {
        const el = getCurrentPage().elements[0];
        return el.src.startsWith('data:') && el.photocopyCopies === 2 && el.originalSrc === original;
    }, original));
    assert(`the panel says so: ${await page.textContent('#prop-photocopy-original')}`, (await page.textContent('#prop-photocopy-original')).includes('2 copies'));
    await page.click('#prop-photocopy-original');
    assert('Back to original restores the picture', await page.evaluate(original => {
        const el = getCurrentPage().elements[0];
        return el.src === original && !el.originalSrc && !el.photocopyCopies && el.filter === 'none';
    }, original));
    assert('and the button goes away', !(await page.$('#prop-photocopy-original')));

    console.log('[Copy again: apply and copy the copy in one click]');
    await page.click('.filter-btn:has-text("Photocopy")');
    const again1 = await canvasPicture();
    await page.click('#prop-photocopy-again');
    await page.waitForFunction(() => getCurrentPage().elements[0].photocopyCopies === 1, null, { timeout: 20000 });
    const kept = await page.evaluate(() => {
        const el = getCurrentPage().elements[0];
        return { src: el.src, filter: el.filter };
    });
    assert('Copy again makes the copy the picture', kept.src === again1.src);
    assert('and stays on Photocopy', kept.filter === 'photocopy' && (await pressed()).join() === 'Photocopy');
    const again2 = await canvasPicture(again1.src);
    assert('the canvas shows the next copy', again2.src !== again1.src);
    await page.click('#prop-photocopy-again');
    await page.waitForFunction(() => getCurrentPage().elements[0].photocopyCopies === 2, null, { timeout: 20000 });
    assert('again: two copies applied', await page.evaluate(src => getCurrentPage().elements[0].src === src, again2.src));
    await page.click('#prop-photocopy-original');
    assert('Back to original still restores it', await page.evaluate(original => getCurrentPage().elements[0].src === original, original));

    await close();
    done();
})();
