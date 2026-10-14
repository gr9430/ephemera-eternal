// opening-night.cjs — opening-night mode (?opening-night): the front cover becomes the show
// poster and the back cover a fixed page of text, both from data/opening-night.json, in the
// preview and the PDF.
'use strict';

const { open, assert, done } = require('./harness.cjs');

// Records which page image lands where on the PDF's cover sheet (same trick as booklet-export.cjs)
async function coverSheet(page) {
    return page.evaluate(async () => {
        const labels = new Map();
        const realCapture = window.html2canvas;
        window.html2canvas = async (el, opts) => {
            const canvas = await realCapture(el, opts);
            const poster = el.querySelector('.opening-night-cover img');
            const label = el.classList.contains('opening-night-cover')
                ? 'Poster' + (poster && poster.complete && poster.naturalWidth > 0 ? '' : ' (not loaded)')
                : el.classList.contains('opening-night-page') ? 'Opening night'
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
    assert('Front cover tab present', (await tabLabels(page)).includes('Front cover'));
    assert('Your info is not filled in for you', await page.evaluate(() =>
        !state.meta.info.name && !state.pages.find(p => p.role === 'their-info').elements.some(e => e.fromInfoForm)));
    assert('PDF uses the drawn back cover', (await coverSheet(page)) ===
        "1L Back cover / 1R Front cover / 2L Your info / 2R Glenn's info");
    await session.close();

    console.log('[?opening-night]');
    session = await open(undefined, '?opening-night');
    page = session.page;
    await page.waitForFunction(() => OpeningNight.paragraphs && OpeningNight.frontCover && OpeningNight.info);

    // Glenn's details: in the form and already on the Your info page, without pressing Fill in page
    const glenn = require('../../data/opening-night.json').info;
    const infoPage = () => page.evaluate(() => ({
        info: state.meta.info,
        texts: state.pages.find(p => p.role === 'their-info').elements.filter(e => e.fromInfoForm).map(e => e.content)
    }));
    await page.waitForFunction(() => state.meta.info.name);
    let filled = await infoPage();
    assert('data/opening-night.json has Glenn\'s name and contact', !!glenn && !!glenn.name && !!glenn.contact);
    assert('the form is filled in with Glenn\'s name, contact and today\'s date',
        filled.info.name === glenn.name && filled.info.contact === glenn.contact && !!filled.info.date);
    assert('the details are already on the Your info page',
        filled.texts.includes(glenn.name) && filled.texts.includes(glenn.contact) && filled.texts.includes(filled.info.date));
    const edited = await page.evaluate(() => {
        state.meta.info.contact = 'changed by hand';
        InfoForm.fill();
        render();
        return state.meta.info.contact;
    });
    assert('a hand edit is kept, not refilled', edited === 'changed by hand');

    await page.click('#randomize-btn');
    await page.click('#randomize-yes-btn');
    await page.click('#randomize-ok-btn');
    filled = await infoPage();
    assert('after Randomize: Glenn\'s details and the locked note are on Your info',
        filled.texts.includes(glenn.name) && filled.texts.includes(glenn.contact) &&
        filled.texts.some(t => t.startsWith('I forewent my creativity')));
    assert('opening-night label shown', !(await page.$eval('#opening-night-badge', el => el.hidden)));
    assert('Back cover tab hidden', !(await tabLabels(page)).includes('Back cover'));
    assert('Front cover tab hidden', !(await tabLabels(page)).includes('Front cover'));
    assert('opens on Your info', await page.evaluate(() => getCurrentPage().role === 'their-info'));

    const movedTo = role => page.evaluate(r => {
        state.currentPage = state.pages.findIndex(p => p.role === r);
        render();
        return getCurrentPage().role;
    }, role);
    assert('moved off the back cover', (await movedTo('back-cover')) === 'their-info');
    assert('moved off the front cover', (await movedTo('front-cover')) === 'their-info');

    // The data file is checked with the server on every load, so a saved copy from before an edit
    // (e.g. a new poster) can't hide the change
    const cacheMode = await page.evaluate(() => {
        let seen = null;
        const realFetch = window.fetch;
        window.fetch = (url, opts) => {
            if (String(url).includes('opening-night.json')) seen = opts && opts.cache;
            return realFetch(url, opts);
        };
        OpeningNight.init();
        window.fetch = realFetch;
        return seen;
    });
    assert('data/opening-night.json is never taken from a stale browser cache', cacheMode === 'no-cache');

    const posterData = require('../../data/opening-night.json').frontCover;
    const cover = await page.evaluate(() => {
        const img = OpeningNight.buildPage('front-cover').querySelector('img');
        return img && img.getAttribute('src');
    });
    assert('front cover is the poster from data/opening-night.json', !!posterData && cover === posterData);

    const missing = await page.evaluate(async () => {
        const saved = OpeningNight.frontCover;
        OpeningNight.frontCover = 'images/organizer/no-such-poster.jpeg';
        const el = OpeningNight.buildPage('front-cover');
        OpeningNight.frontCover = saved;
        document.body.appendChild(el);
        await new Promise(r => setTimeout(r, 500));
        const text = el.textContent;
        el.remove();
        return text;
    });
    assert('a missing poster says so', missing.includes('Front cover image not set'));

    // Compared against the data file itself, so Glenn can reword it without breaking this check
    const expected = require('../../data/opening-night.json').paragraphs;
    const built = await page.evaluate(() => [...OpeningNight.buildPage().querySelectorAll('p')].map(p => p.textContent));
    assert('fixed page shows each entry of data/opening-night.json as its own paragraph',
        expected.length > 0 && JSON.stringify(built) === JSON.stringify(expected));

    await page.click('#preview-btn');
    assert('reading preview shows the fixed back cover', await page.$$eval('#preview-pages .opening-night-page', els => els.length === 1));
    assert('reading preview shows the poster cover', await page.$$eval('#preview-pages .opening-night-cover', els => els.length === 1));
    await page.click('#preview-view-toggle button[data-view="booklet"]');
    assert('booklet preview shows the fixed back cover', await page.$$eval('#preview-pages .opening-night-page', els => els.length === 1));
    assert('booklet preview shows the poster cover', await page.$$eval('#preview-pages .opening-night-cover', els => els.length === 1));
    await page.click('#preview-view-toggle button[data-view="reading"]');
    await page.click('#preview-close');

    assert('PDF puts the fixed page and the loaded poster on the covers', (await coverSheet(page)) ===
        "1L Opening night / 1R Poster / 2L Your info / 2R Glenn's info");

    await session.close();
    done();
})();
