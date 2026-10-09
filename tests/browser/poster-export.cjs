// poster-export.cjs — poster formats: sheet size, page controls, one portrait PDF page; single-page unchanged.
'use strict';

const { open, assert, done } = require('./harness.cjs');

(async () => {
    const { page, close } = await open();
    await page.evaluate(() => { window.jspdf.jsPDF.API.save = function (name) { window.__saved = name; }; });

    for (const [format, w, h, pw, ph] of [['poster-letter', 816, 1056, 612, 792], ['poster-legal', 816, 1344, 612, 1008]]) {
        console.log(`[${format}]`);
        await page.selectOption('#page-format', format);
        const ui = await page.evaluate(() => {
            const c = document.querySelector('.canvas-container');
            return {
                w: c.offsetWidth, h: c.offsetHeight, pages: state.pages.length,
                add: document.getElementById('add-page-btn').disabled,
                remove: document.getElementById('remove-page-btn').disabled,
                importHidden: document.getElementById('import-pages-btn').hidden,
                rotateShown: !document.getElementById('rotate-right-btn').hidden,
                panelGuides: !!document.querySelector('.panel-guides')
            };
        });
        assert(`sheet is ${w} x ${h}`, ui.w === w && ui.h === h);
        assert('one page, add/remove disabled, import hidden', ui.pages === 1 && ui.add && ui.remove && ui.importHidden);
        assert('rotate shown, no panel guides', ui.rotateShown && !ui.panelGuides);

        const pdf = await page.evaluate(async () => {
            await generatePDF();
            const doc = await buildSheetPdf();
            return { name: window.__saved, count: doc.getNumberOfPages(), w: doc.internal.pageSize.getWidth(), h: doc.internal.pageSize.getHeight() };
        });
        assert('one PDF page', pdf.count === 1);
        assert(`portrait ${pw} x ${ph} pt`, Math.round(pdf.w) === pw && Math.round(pdf.h) === ph);
        assert(`named ${format}-YYYY-MM-DD.pdf`, new RegExp(`^${format}-\\d{4}-\\d{2}-\\d{2}\\.pdf$`).test(pdf.name));
    }

    console.log('[single-page unchanged]');
    await page.selectOption('#page-format', 'single-page');
    const single = await page.evaluate(async () => {
        await generatePDF();
        const doc = await buildSheetPdf();
        return { name: window.__saved, w: doc.internal.pageSize.getWidth(), h: doc.internal.pageSize.getHeight() };
    });
    assert('landscape 792 x 612 pt', Math.round(single.w) === 792 && Math.round(single.h) === 612);
    assert('same file name as before', /^zine-single-page-folded-\d{4}-\d{2}-\d{2}\.pdf$/.test(single.name));

    await close();
    done();
})();
