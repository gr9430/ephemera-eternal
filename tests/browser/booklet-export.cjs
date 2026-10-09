// booklet-export.cjs — booklet PDF imposition in both modes, the export dialog, missing organizer data.
'use strict';

const { open, assert, done } = require('./harness.cjs');

(async () => {
    const { page, close } = await open();

    // A booklet with 5 inside pages; every page carries its own label as text so every capture differs.
    // html2canvas and jsPDF.addImage are wrapped to record which page image lands where.
    await page.evaluate(() => {
        state.pages = makeBookletPages(generateId);
        for (let i = 0; i < 4; i++) state.pages.splice(3, 0, { id: generateId(), role: 'inside', elements: [] });
        state.pages.forEach((p, i) => p.elements.push(Object.assign(createTextElement(60, 60), { content: pageLabel(state.pages, i), rotation: 0 })));
        state.currentPage = 3;
        render();

        window.__labels = new Map();
        window.__darkest = 255;
        window.__placed = [];
        const realCapture = window.html2canvas;
        window.html2canvas = async (el, opts) => {
            const canvas = await realCapture(el, opts);
            const label = el.classList.contains('organizer-page') ? "Glenn's info"
                : el.classList.contains('addendum-page') ? 'Addendum'
                : pageLabel(state.pages, state.currentPage);
            window.__labels.set(canvas.toDataURL('image/png'), label);
            if (el.classList.contains('canvas-container')) {
                // Darkest pixel along an empty row (y = 400 css px), edges excluded: guides or shadow show up here
                const row = canvas.getContext('2d').getImageData(8, 800, canvas.width - 16, 1).data;
                let min = 255;
                for (let i = 0; i < row.length; i += 4) min = Math.min(min, row[i]);
                window.__darkest = Math.min(window.__darkest, min);
            }
            return canvas;
        };
        const api = window.jspdf.jsPDF.API;
        const realAdd = api.addImage;
        api.addImage = function (img, format, x) {
            window.__placed.push(`${this.getNumberOfPages()}${x === 0 ? 'L' : 'R'} ${window.__labels.get(img)}`);
            return realAdd.apply(this, arguments);
        };
        api.save = function (name) { window.__saved = name; };
    });

    const run = mode => page.evaluate(async mode => {
        window.__placed = [];
        const pdf = await buildBookletPdf(mode);
        return { count: pdf.getNumberOfPages(), w: pdf.internal.pageSize.getWidth(), h: pdf.internal.pageSize.getHeight(), placed: window.__placed };
    }, mode);

    console.log('[double-sided]');
    const duplex = await run('duplex');
    assert('cover sheet + 2 inside sheets = 6 sides', duplex.count === 6);
    assert('pages are 792 x 612 pt', Math.round(duplex.w) === 792 && Math.round(duplex.h) === 612);
    assert('every page lands in the right half, blanks left empty', duplex.placed.join(' / ') === [
        '1L Back cover', '1R Front cover', '2L Your info', "2R Glenn's info",
        '3R Addendum', '4L Page 1', '5L Page 5', '5R Page 2', '6L Page 3', '6R Page 4'
    ].join(' / '));

    console.log('[two passes]');
    const twoPass = await run('two-pass');
    assert('all fronts, then all backs', twoPass.placed.join(' / ') === [
        '1L Back cover', '1R Front cover', '2R Addendum', '3L Page 5', '3R Page 2',
        '4L Your info', "4R Glenn's info", '5L Page 1', '6L Page 3', '6R Page 4'
    ].join(' / '));

    console.log('[export dialog]');
    // The direct buildBookletPdf calls above leave the last captured page on screen
    await page.evaluate(() => { state.currentPage = 3; render(); window.__darkest = 255; });
    await page.click('#print-btn');
    assert('dialog opens for half-letter', await page.$eval('#booklet-export-modal', el => el.classList.contains('show')));
    await page.click('#booklet-export-modal button[data-mode=""]');
    assert('cancel closes it and saves nothing', await page.evaluate(() => !document.getElementById('booklet-export-modal').classList.contains('show') && !window.__saved));
    await page.click('#print-btn');
    await page.click('#booklet-export-modal button[data-mode="duplex"]');
    await page.waitForFunction(() => window.__saved);
    assert('filename names the mode', await page.evaluate(() => /^zine-booklet-duplex-\d{4}-\d{2}-\d{2}\.pdf$/.test(window.__saved)));
    assert('captured pages have no guide lines or drop shadow', await page.evaluate(() => window.__darkest >= 240));
    assert('page on screen restored', await page.evaluate(() => state.currentPage === 3));
    assert('button restored', await page.$eval('#print-btn', b => !b.disabled && b.textContent === 'Save as PDF'));

    console.log('[missing organizer data]');
    const missing = await page.evaluate(async () => {
        state.organizer = null;
        window.__placed = [];
        const pdf = await buildBookletPdf('duplex');
        return { count: pdf.getNumberOfPages(), placed: window.__placed };
    });
    assert('export still completes with Glenn\'s slot filled', missing.count === 6 && missing.placed.includes("2R Glenn's info"));

    console.log('[missing addendum text]');
    const noAddendum = await page.evaluate(async () => {
        const saved = Addendum.data;
        Addendum.data = null;
        const text = buildAddendumPage().textContent;
        const pdf = await buildBookletPdf('duplex');
        Addendum.data = saved;
        return { text, count: pdf.getNumberOfPages() };
    });
    assert('a missing addendum file still exports, with a placeholder page', noAddendum.text === 'Addendum text not set' && noAddendum.count === 6);

    console.log('[single-page still exports one sheet]');
    const sheet = await page.evaluate(async () => {
        document.getElementById('page-format').value = 'single-page';
        document.getElementById('page-format').dispatchEvent(new Event('change'));
        const pdf = await buildSheetPdf();
        return pdf.getNumberOfPages();
    });
    assert('one landscape page', sheet === 1);

    await close();
    done();
})();
