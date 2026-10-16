// workshop-covers.cjs — ?workshop booklets: the back cover is images/organizer/workshop.png (no Back
// cover tab; in the Preview and the PDF), Your info starts empty for the participant, and a booklet
// stops at 11 inside pages (16 in all). The public version keeps its own back cover and 23 pages.
'use strict';

const { open, assert, done } = require('./harness.cjs');

const tabLabels = page => page.$$eval('.page-tab', tabs => tabs.map(t => t.textContent));
const insideCount = page => page.evaluate(() => insideIndexes(state.pages).length);
const dataLoaded = page => page.waitForFunction(() =>
    state.photoImages.length && state.clipartImages.length && state.grammar.slogan && state.grammar.slogan.length);

// Which page image lands where on the PDF's cover sheet (same trick as opening-night.cjs)
async function coverSheet(page) {
    return page.evaluate(async () => {
        const labels = new Map();
        const realCapture = window.html2canvas;
        window.html2canvas = async (el, opts) => {
            const canvas = await realCapture(el, opts);
            const img = el.querySelector('.workshop-back img');
            const label = el.classList.contains('workshop-back')
                ? 'Workshop back' + (img && img.complete && img.naturalWidth > 0 ? '' : ' (not loaded)')
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

(async () => {
    console.log('[?workshop: Your info is the participant\'s]');
    let session = await open();
    let page = session.page;
    assert('Your info starts empty', await page.evaluate(() =>
        !state.meta.info.name && !state.meta.info.contact &&
        !state.pages.find(p => p.role === 'their-info').elements.some(e => e.fromInfoForm)));
    assert('the form starts empty', await page.evaluate(() =>
        ['info-name', 'info-contact'].every(id => document.getElementById(id).value === '')));

    console.log('[?workshop: the back cover is workshop.png]');
    const tabs = await tabLabels(page);
    assert('no Back cover tab', !tabs.includes('Back cover'));
    assert('Front cover and Your info tabs still there', tabs.includes('Front cover') && tabs.includes('Your info'));
    await page.click('#preview-btn');
    await page.waitForFunction(() => {
        const img = document.querySelector('#preview-pages .workshop-back img');
        return img && img.complete && img.naturalWidth > 0;
    });
    assert('Preview shows workshop.png', await page.$eval('#preview-pages .workshop-back img', img => img.getAttribute('src')) ===
        'images/organizer/workshop.png');
    await page.click('#preview-close');
    assert('PDF cover sheet has workshop.png on the back', (await coverSheet(page)) ===
        "1L Workshop back / 1R Front cover / 2L Your info / 2R Glenn's info");
    assert('a missing image says so', await page.evaluate(async () => {
        const real = WorkshopBack.src;
        WorkshopBack.src = 'images/organizer/no-such-back.png';
        const el = WorkshopBack.buildPage();
        WorkshopBack.src = real;
        document.body.appendChild(el);
        await new Promise(r => setTimeout(r, 500));
        const text = el.textContent;
        el.remove();
        return text.includes('Back cover image missing');
    }));

    console.log('[?workshop: 16 pages in all]');
    for (let i = 0; i < 15; i++) {
        if (await page.$eval('#add-page-btn', b => b.disabled)) break;
        await page.click('#add-page-btn');
    }
    assert('+ Page stops at 11 inside pages', (await insideCount(page)) === 11 && await page.$eval('#add-page-btn', b => b.disabled));
    const project = { pageFormat: 'half-letter', pages: [{ id: 1, role: 'inside', elements: [] }, { id: 2, role: 'inside', elements: [] }] };
    await page.setInputFiles('#import-pages-input', { name: 'more.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
    await page.waitForSelector('#save-notice');
    assert('Import Pages skips past 11 and says so', (await page.textContent('#save-notice')).includes('skipped 2 (11-page limit)') &&
        (await insideCount(page)) === 11);
    await dataLoaded(page);
    const kept = await page.evaluate(() => {
        const back = state.pages.find(p => p.role === 'back-cover');
        back.elements.push(Object.assign(createTextElement(60, 60), { content: 'my back cover' }));
        Randomize.apply();
        const after = state.pages.find(p => p.role === 'back-cover');
        return { inside: insideIndexes(state.pages).length, back: after.elements.some(e => e.content === 'my back cover') };
    });
    assert('Randomize makes 11 inside pages', kept.inside === 11);
    assert('and leaves the stored back cover alone', kept.back);
    await page.evaluate(() => Randomize.finish());
    await session.close();

    console.log('[?workshop&opening-night keeps its own back cover]');
    session = await open(undefined, '?workshop&opening-night');
    page = session.page;
    assert('opening-night text, not workshop.png', await page.evaluate(() =>
        FixedPages.buildPage('back-cover').classList.contains('opening-night-page')));
    await session.close();

    console.log('[public: unchanged]');
    session = await open(undefined, '');
    page = session.page;
    await page.waitForSelector('#welcome-modal.show');
    await page.click('#welcome-start-btn');
    assert('Back cover tab present', (await tabLabels(page)).includes('Back cover'));
    assert('back cover is not fixed', await page.evaluate(() => !FixedPages.replaces('back-cover')));
    for (let i = 0; i < 12; i++) await page.click('#add-page-btn');
    assert('more than 11 inside pages allowed', (await insideCount(page)) === 13);
    await session.close();

    done();
})();
