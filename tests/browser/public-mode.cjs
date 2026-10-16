// public-mode.cjs — the public version (the plain URL): the welcome, the Print & fold dialog, and
// offering consented words at Save as PDF, and that none of it appears with ?workshop.
'use strict';

const fs = require('fs');
const { open, assert, done } = require('./harness.cjs');
const config = require('../../data/public.json');

const isShown = (page, id) => page.$eval('#' + id, el => el.classList.contains('show'));
// Waits until the public-only modules have set themselves up (they start after the fonts load),
// so a modal that should have opened by now has
const configLoaded = async page => {
    await page.waitForFunction(() => typeof Welcome !== 'undefined' && Welcome.ready);
    await page.evaluate(() => Welcome.ready);
};
async function reloaded(page) {
    await page.reload();
    await page.waitForFunction(() => typeof Autosave !== 'undefined' && Autosave.enabled);
    await configLoaded(page);
}
// The public version with the first-visit welcome already dismissed
async function openPublic() {
    const session = await open(undefined, '');
    await session.page.waitForSelector('#welcome-modal.show');
    await session.page.click('#welcome-start-btn');
    return session;
}

// Swaps the PDF builders for stand-ins that only record the file name, so a save is instant
const stubPdf = page => page.evaluate(() => {
    window.savedPdfs = [];
    const fake = async () => ({ save: name => window.savedPdfs.push(name) });
    window.buildBookletPdf = fake;
    window.buildSheetPdf = fake;
});
const savedPdfs = page => page.evaluate(() => window.savedPdfs.length);
// Presses Save as PDF; bookletMode is what the booklet question answers ('duplex', 'two-pass', or null for Cancel)
async function saveAs(page, bookletMode) {
    await page.evaluate(m => { window.chooseBookletMode = async () => m; }, bookletMode);
    await page.click('#print-btn');
}

(async () => {
    console.log('[public: welcome on the first visit]');
    let session = await open(undefined, '');
    let page = session.page;
    await page.waitForSelector('#welcome-modal.show');
    assert('heading from data/public.json', (await page.textContent('#welcome-title')) === config.welcome.heading);
    assert('one paragraph per entry', (await page.$$eval('#welcome-paragraphs p', ps => ps.length)) === config.welcome.paragraphs.length);
    assert('numbered steps from data/public.json', JSON.stringify(await page.$$eval('#welcome-steps li', lis => lis.map(li => li.textContent))) ===
        JSON.stringify(config.welcome.steps));
    assert('How to button shown', !(await page.$eval('#how-to-btn', b => b.hidden)));
    await page.click('#welcome-start-btn');
    assert('Start closes it', !(await isShown(page, 'welcome-modal')));
    await reloaded(page);
    assert('not shown again on the next visit', !(await isShown(page, 'welcome-modal')));
    await page.click('#new-zine-btn');   // the harness accepts the confirm
    await page.waitForTimeout(200);
    assert('New does not bring it back', !(await isShown(page, 'welcome-modal')));
    await page.click('#how-to-btn');
    assert('How to reopens it', await isShown(page, 'welcome-modal'));
    await page.keyboard.press('Escape');
    assert('Escape closes it', !(await isShown(page, 'welcome-modal')));
    assert('focus goes back to How to', await page.evaluate(() => document.activeElement.id === 'how-to-btn'));
    await session.close();

    console.log('[public: storage blocked]');
    session = await open(undefined, '');
    page = session.page;
    await page.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
    });
    await reloaded(page);
    assert('welcome shows', await isShown(page, 'welcome-modal'));
    await page.click('#welcome-start-btn');
    assert('Start still closes it', !(await isShown(page, 'welcome-modal')));
    await reloaded(page);
    assert('and it shows again next visit', await isShown(page, 'welcome-modal'));
    await session.close();

    console.log('[public: data/public.json missing]');
    session = await open(undefined, '');
    page = session.page;
    await page.route('**/data/public.json', route => route.fulfill({ status: 404, body: '' }));
    await reloaded(page);
    assert('no welcome', !(await isShown(page, 'welcome-modal')));
    assert('no How to', await page.$eval('#how-to-btn', b => b.hidden));
    assert('the editor still works', await page.evaluate(() => state.pages.length > 0 && !!document.querySelector('.page-tab')));
    await session.close();

    console.log('[workshop: no welcome]');
    session = await open();   // the harness opens ?workshop by default
    page = session.page;
    await configLoaded(page);
    assert('no welcome with ?workshop', !(await isShown(page, 'welcome-modal')));
    assert('no How to with ?workshop', await page.$eval('#how-to-btn', b => b.hidden));
    await session.close();

    console.log('[public: Print & fold after the PDF saves]');
    session = await openPublic();
    page = session.page;
    await stubPdf(page);
    const helpSteps = () => page.$$eval('#print-help-steps li', lis => lis.map(li => li.textContent));
    assert('double-sided steps say flip on short edge', config.printHelp.duplex.join(' ').includes('flip on short edge'));
    for (const [format, mode, kind] of [
        ['half-letter', 'duplex', 'duplex'], ['half-letter', 'two-pass', 'two-pass'],
        ['single-page', null, 'sheet'], ['stapled', null, 'sheet'],
        ['poster-letter', null, 'poster'], ['poster-legal', null, 'poster']
    ]) {
        await page.selectOption('#page-format', format);
        await saveAs(page, mode);
        await page.waitForSelector('#print-help-modal.show');
        assert(`${format}${mode ? ' ' + mode : ''}: the ${kind} steps`, JSON.stringify(await helpSteps()) === JSON.stringify(config.printHelp[kind]));
        await page.click('#print-help-done-btn');
        assert('Done closes it', !(await isShown(page, 'print-help-modal')));
    }
    const before = await savedPdfs(page);
    await page.selectOption('#page-format', 'half-letter');
    await saveAs(page, null);
    await page.waitForTimeout(300);
    assert('cancelled booklet: no PDF, no dialog', (await savedPdfs(page)) === before && !(await isShown(page, 'print-help-modal')));
    await page.selectOption('#page-format', 'single-page');
    await page.evaluate(() => { window.buildSheetPdf = async () => { throw new Error('test failure'); }; });
    await Promise.all([page.waitForEvent('dialog'), saveAs(page, null)]);   // the harness accepts the failure alert
    await page.waitForFunction(() => !document.getElementById('print-btn').disabled);
    assert('failed save: no dialog', !(await isShown(page, 'print-help-modal')));
    await stubPdf(page);
    await saveAs(page, null);
    await page.waitForSelector('#print-help-modal.show');
    await page.keyboard.press('Escape');
    assert('Escape closes it', !(await isShown(page, 'print-help-modal')));
    await session.close();

    console.log('[workshop: no Print & fold]');
    session = await open();
    page = session.page;
    await stubPdf(page);
    await page.selectOption('#page-format', 'single-page');
    await saveAs(page, null);
    await page.waitForFunction(() => window.savedPdfs.length === 1);
    await page.waitForTimeout(200);
    assert('PDF saved with no dialog', !(await isShown(page, 'print-help-modal')));
    await session.close();

    console.log('[public: offering the words at Save as PDF]');
    session = await openPublic();
    page = session.page;
    await stubPdf(page);
    const addWords = async text => {
        await page.fill('#word-entry', text);
        await page.click('#word-entry-add-btn');
        await page.click('#word-consent-yes-btn');
    };
    const statuses = () => page.evaluate(async () => (await WordStore.all()).map(e => e.status));
    // Waits for the n-th saved PDF and closes the Print & fold dialog that follows it
    const finishSave = async n => {
        await page.waitForFunction(count => window.savedPdfs.length === count, n);
        await page.waitForSelector('#print-help-modal.show');
        await page.click('#print-help-done-btn');
    };
    const offerShown = () => page.waitForSelector('#words-send-modal.show');

    await page.selectOption('#page-format', 'single-page');
    await saveAs(page, null);
    await finishSave(1);
    assert('no words: the PDF saves without asking', true);

    await addWords('the corner store remembers');
    await addWords('rent is a\nfour-letter word');
    await page.waitForFunction(async () => (await WordStore.all()).length === 2);
    await saveAs(page, null);
    await offerShown();
    assert('asks before the PDF', (await savedPdfs(page)) === 1);
    assert('says how many', (await page.textContent('#words-send-title')) === 'You offered 2 words or lines to the algorithm. Send them to Glenn?');
    assert('lists them', JSON.stringify(await page.$$eval('#words-send-list li', lis => lis.map(li => li.textContent))) ===
        JSON.stringify(['the corner store remembers', 'rent is a\nfour-letter word']));
    const href = await page.$eval('#words-send-email-btn', a => a.getAttribute('href'));
    assert('email link to the address in data/public.json', href.startsWith(`mailto:${config.wordsEmail}?subject=Words%20for%20Ephemera%20Eternal&body=`));

    await page.click('#words-send-later-btn');
    await finishSave(2);
    assert('Not now: still pending', JSON.stringify(await statuses()) === '["pending","pending"]');
    await saveAs(page, null);
    await offerShown();
    await page.keyboard.press('Escape');
    await finishSave(3);
    await saveAs(page, null);
    await offerShown();
    await page.mouse.click(5, 5);
    await finishSave(4);
    assert('Escape and a click outside: still pending', JSON.stringify(await statuses()) === '["pending","pending"]');

    await saveAs(page, null);
    await offerShown();
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#words-send-download-btn')]);
    assert('file name my-words-YYYY-MM-DD.txt', /^my-words-\d{4}-\d{2}-\d{2}\.txt$/.test(download.suggestedFilename()));
    assert('file: header, then one entry per line', /^Words offered to Ephemera Eternal, \d{4}-\d{2}-\d{2}\n\nthe corner store remembers\nrent is a \/ four-letter word\n$/
        .test(fs.readFileSync(await download.path(), 'utf8')));
    await page.waitForSelector('#words-send-attach:not([hidden])');
    assert('says where to send it', (await page.textContent('#words-send-attach-note')) === `Attach this file to an email to ${config.wordsEmail}.`);
    assert('the PDF waits for Continue', (await savedPdfs(page)) === 4);
    assert('Download marks them sent', JSON.stringify(await statuses()) === '["sent","sent"]' &&
        await page.evaluate(async () => (await WordStore.all()).every(e => e.sentAt)));
    await page.click('#words-send-continue-btn');
    await finishSave(5);
    await saveAs(page, null);
    await finishSave(6);
    assert('sent words are not offered again', true);

    await addWords('a third line');
    await page.waitForFunction(async () => (await WordStore.all()).length === 3);
    await saveAs(page, null);
    await offerShown();
    assert('only the unsent word, in the singular', (await page.$$eval('#words-send-list li', lis => lis.length)) === 1 &&
        (await page.textContent('#words-send-title')).startsWith('You offered 1 word or line'));
    // No mail app in the test browser: keep the link from navigating
    await page.evaluate(() => document.getElementById('words-send-email-btn').addEventListener('click', e => e.preventDefault()));
    await page.click('#words-send-email-btn');
    await finishSave(7);
    assert('Open email marks it sent', JSON.stringify(await statuses()) === '["sent","sent","sent"]');

    await page.evaluate(async () => {
        for (let i = 0; i < 30; i++) await WordStore.add(`a long line of words, number ${i}, that goes on for a while`);
    });
    await saveAs(page, null);
    await offerShown();
    assert('too long for a link: no Open email', await page.$eval('#words-send-email-btn', a => a.hidden));
    assert('says to download and attach', !(await page.$eval('#words-send-too-long', p => p.hidden)));
    await page.click('#words-send-later-btn');
    await finishSave(8);

    await page.route('**/data/public.json', route => route.fulfill({
        contentType: 'application/json', body: JSON.stringify(Object.assign({}, config, { wordsEmail: '' }))
    }));
    await reloaded(page);
    await stubPdf(page);
    await page.selectOption('#page-format', 'single-page');
    await saveAs(page, null);
    await finishSave(1);
    assert('no address: pending words, but no offer', (await statuses()).includes('pending'));
    await session.close();

    console.log('[workshop: no offer]');
    session = await open();
    page = session.page;
    await stubPdf(page);
    await page.evaluate(() => WordStore.add('workshop words'));
    await page.selectOption('#page-format', 'single-page');
    await saveAs(page, null);
    await page.waitForFunction(() => window.savedPdfs.length === 1);
    assert('PDF saved without an offer', !(await isShown(page, 'words-send-modal')));
    await session.close();

    done();
})();
