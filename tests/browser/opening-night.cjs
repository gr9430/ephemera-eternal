// opening-night.cjs — opening-night mode (?opening-night): the back cover becomes a fixed
// page of text from data/opening-night.json, in the preview and the PDF.
'use strict';

const { open, assert, done } = require('./harness.cjs');

// Records which page image lands where on the PDF's cover sheet (same trick as booklet-export.cjs)
async function coverSheet(page) {
    return page.evaluate(async () => {
        const labels = new Map();
        const realCapture = window.html2canvas;
        window.html2canvas = async (el, opts) => {
            const canvas = await realCapture(el, opts);
            const label = el.classList.contains('opening-night-page') ? 'Opening night'
                : el.classList.contains('organizer-page') ? "Glenn's info"
                : pageLabel(state.pages, state.currentPage);
            labels.set(canvas.toDataURL('image/png'), label);
            return canvas;
        };
        const placed = [];
        const api = window.jspdf.jsPDF.API;
        const realAdd = api.addImage;
        api.addImage = function (img, format, x) {
            placed.push(`${this.getNumberOfPages()}${x === 0 ? 'L' : 'R'} ${labels.get(img)}`);
            return realAdd.apply(this, arguments);
        };
        try {
            await buildBookletPdf('duplex');
        } finally {
            window.html2canvas = realCapture;
            api.addImage = realAdd;
        }
        return placed.slice(0, 4).join(' / ');
    });
}

const tabLabels = page => page.$$eval('.page-tab', tabs => tabs.map(t => t.textContent));

(async () => {
    console.log('[normal address]');
    let session = await open();
    let page = session.page;
    assert('no opening-night label', await page.$eval('#opening-night-badge', el => el.hidden));
    assert('Back cover tab present', (await tabLabels(page)).includes('Back cover'));
    assert('PDF uses the drawn back cover', (await coverSheet(page)) ===
        "1L Back cover / 1R Front cover / 2L Your info / 2R Glenn's info");
    await session.close();

    console.log('[?opening-night]');
    session = await open(undefined, '?opening-night');
    page = session.page;
    await page.waitForFunction(() => OpeningNight.paragraphs);
    assert('opening-night label shown', !(await page.$eval('#opening-night-badge', el => el.hidden)));
    assert('Back cover tab hidden', !(await tabLabels(page)).includes('Back cover'));

    const moved = await page.evaluate(() => {
        state.currentPage = state.pages.findIndex(p => p.role === 'back-cover');
        render();
        return getCurrentPage().role;
    });
    assert('moved off the back cover', moved === 'front-cover');

    // Compared against the data file itself, so Glenn can reword it without breaking this check
    const expected = require('../../data/opening-night.json').paragraphs;
    const built = await page.evaluate(() => [...OpeningNight.buildPage().querySelectorAll('p')].map(p => p.textContent));
    assert('fixed page shows each entry of data/opening-night.json as its own paragraph',
        expected.length > 0 && JSON.stringify(built) === JSON.stringify(expected));

    await page.click('#preview-btn');
    assert('reading preview shows the fixed back cover', await page.$$eval('#preview-pages .opening-night-page', els => els.length === 1));
    await page.click('#preview-view-toggle button[data-view="booklet"]');
    assert('booklet preview shows the fixed back cover', await page.$$eval('#preview-pages .opening-night-page', els => els.length === 1));
    await page.click('#preview-view-toggle button[data-view="reading"]');
    await page.click('#preview-close');

    assert('PDF puts the fixed page in the back-cover spot', (await coverSheet(page)) ===
        "1L Opening night / 1R Front cover / 2L Your info / 2R Glenn's info");

    await session.close();
    done();
})();
