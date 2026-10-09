// poster-credit.cjs — the fixed credit line on posters: placement, stacking, not saved, in the PDF
// capture and the Preview, kept by New, absent on other formats, and a missing data file.
'use strict';

const fs = require('fs');
const path = require('path');
const { open, assert, done } = require('./harness.cjs');
const CREDIT = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'poster.json'), 'utf8')).credit;

(async () => {
    const { page, close } = await open();
    await page.waitForFunction(() => Poster.credit !== '');
    await page.selectOption('#page-format', 'poster-letter');
    await page.evaluate(() => setViewZoom(1));

    console.log('[on screen]');
    const strip = await page.evaluate(() => {
        const s = document.querySelector('.canvas-container .poster-credit');
        if (!s) return null;
        const cs = getComputedStyle(s);
        return { text: s.textContent, bottom: s.offsetTop + s.offsetHeight, h: s.offsetHeight, z: +cs.zIndex,
            contentZ: +getComputedStyle(document.getElementById('canvas-content')).zIndex, events: cs.pointerEvents,
            guidesBottom: getComputedStyle(document.querySelector('.canvas-guides')).bottom };
    });
    assert('strip shows the poster.json text', strip && strip.text === CREDIT);
    assert('20px tall, bottom edge 24px above the sheet bottom', strip && strip.h === 20 && strip.bottom === 1056 - 24);
    assert('above every element, clicks pass through', strip && strip.z > strip.contentZ && strip.events === 'none');
    assert('margin guide stops at the strip', strip && strip.guidesBottom === '44px');
    assert('not in the saved project', await page.evaluate(c => !JSON.stringify(state).includes(c), CREDIT));

    console.log('[in the PDF capture]');
    const captured = await page.evaluate(async () => {
        const real = window.html2canvas;
        let seen = null;
        window.html2canvas = async (el, opts) => {
            const s = el.querySelector('.poster-credit');
            const canvas = await real(el, opts);
            // darkest pixel across the strip's middle row (capture scale is 2)
            const row = canvas.getContext('2d').getImageData(0, (1056 - 34) * 2, canvas.width, 1).data;
            let min = 255;
            for (let i = 0; i < row.length; i += 4) min = Math.min(min, row[i]);
            seen = { present: !!s && getComputedStyle(s).display !== 'none', darkest: min };
            return canvas;
        };
        window.jspdf.jsPDF.API.save = function () {};
        await generatePDF();
        window.html2canvas = real;
        return seen;
    });
    assert('strip is in the captured sheet', captured && captured.present);
    assert('its text is painted', captured && captured.darkest < 128);

    console.log('[Digital Preview]');
    await page.click('#preview-btn');
    const preview = await page.$eval('.preview-page', p => ({ w: p.offsetWidth, h: p.offsetHeight, credit: (p.querySelector('.poster-credit') || {}).textContent }));
    assert('whole sheet, 816 x 1056', preview.w === 816 && preview.h === 1056);
    assert('credit shown', preview.credit === CREDIT);
    await page.evaluate(() => closeDigitalPreview());

    console.log('[New keeps a blank poster]');
    await page.selectOption('#page-format', 'poster-legal');
    await page.evaluate(() => addElement(createTextElement(100, 100)));
    await page.click('#new-zine-btn');   // harness accepts the confirm
    await page.waitForFunction(() => getCurrentPage().elements.length === 0);
    assert('still poster-legal, one page, strip there', await page.evaluate(() =>
        state.pageFormat === 'poster-legal' && state.pages.length === 1 && !!document.querySelector('.canvas-container .poster-credit')));

    console.log('[other formats]');
    await page.selectOption('#page-format', 'half-letter');
    assert('no strip on a booklet', await page.evaluate(() => !document.querySelector('.canvas-container .poster-credit')));

    console.log('[missing poster.json]');
    const missing = await page.evaluate(async () => {
        Poster.credit = '';
        document.getElementById('page-format').value = 'poster-letter';
        document.getElementById('page-format').dispatchEvent(new Event('change'));
        const strip = !!document.querySelector('.canvas-container .poster-credit');
        const doc = await buildSheetPdf();
        return { strip, pages: doc.getNumberOfPages() };
    });
    assert('no strip, poster still exports', !missing.strip && missing.pages === 1);

    await close();
    done();
})();
