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

    done();
})();
