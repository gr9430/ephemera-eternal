// info-and-import.cjs — the their-info form, and importing pages from other projects.
'use strict';

const { open, assert, done } = require('./harness.cjs');

(async () => {
    const { page, close } = await open();
    const panelHidden = () => page.$eval('#info-form-panel', el => el.hidden);

    console.log('[info form]');
    assert('hidden on the front cover', await panelHidden());
    await page.click('.page-tab[data-page="1"]');
    assert('shown on the their-info tab', !(await panelHidden()));
    assert('date defaults to today', (await page.inputValue('#info-date')).length > 0);

    await page.fill('#info-name', 'Ana');
    await page.fill('#info-note', 'I live here');
    await page.click('#info-fill-btn');
    const first = await page.evaluate(() => getCurrentPage().elements.map(e => ({ content: e.content, form: !!e.fromInfoForm })));
    assert('creates text elements for filled fields', first.map(e => e.content).join('|') === `Ana|${first[1].content}|I live here` && first.every(e => e.form));

    await page.evaluate(() => {
        getCurrentPage().elements[0].content = 'Ana R.';   // participant edits a form element
        getCurrentPage().elements.push(Object.assign(createTextElement(300, 600), { content: 'my doodle' }));
        render();
    });
    await page.fill('#info-name', 'Bo');
    await page.click('#info-fill-btn');
    const second = await page.evaluate(() => getCurrentPage().elements.map(e => e.content));
    assert('refill replaces form elements, keeps the participant\'s own', second[0] === 'my doodle' && second.includes('Bo') && !second.includes('Ana R.'));
    assert('form values stored in meta.info', await page.evaluate(() => state.meta.info.name === 'Bo'));

    const fonts = await page.evaluate(() => {
        const used = new Set();
        for (let i = 0; i < 12; i++) {
            InfoForm.fill();
            getCurrentPage().elements.filter(e => e.fromInfoForm).forEach(e => used.add(e.font));
        }
        const available = Object.keys(state.fonts);
        return { used: [...used], available: available.length, allKnown: [...used].every(f => available.includes(f)) };
    });
    assert(`form text uses random fonts from the font list (${fonts.used.length} of ${fonts.available} seen)`,
        fonts.allKnown && fonts.used.length > 1);

    // Small fields (contact, date, note) stay readable; the big name keeps the full, wilder font set
    const split = await page.evaluate(() => {
        state.meta.info.contact = '@bo';
        const readable = randomFontLists(fontSources, state.fonts).readable;
        const small = new Set(), name = new Set();
        for (let i = 0; i < 20; i++) {
            InfoForm.fill();
            getCurrentPage().elements.filter(e => e.fromInfoForm).forEach(e =>
                (e.content === state.meta.info.name ? name : small).add(e.font));
        }
        delete state.meta.info.contact;   // later checks expect no contact
        InfoForm.fill();
        return { smallOk: [...small].every(f => readable.includes(f)), nameWild: [...name].some(f => !readable.includes(f)) };
    });
    assert('contact, date and note use readable fonts only', split.smallOk);
    assert('the name still draws from the decorative fonts too', split.nameWild);

    await page.fill('#info-date', '');
    await page.click('#info-fill-btn');
    assert('a cleared date stays cleared', (await page.inputValue('#info-date')) === '');
    assert('and is left off the page', await page.evaluate(() => getCurrentPage().elements.filter(e => e.fromInfoForm).map(e => e.content).join('|') === 'Bo|I live here'));

    await page.selectOption('#page-format', 'single-page');
    assert('hidden for single-page', await panelHidden());
    await page.selectOption('#page-format', 'half-letter');

    console.log('[import pages]');
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zine-import-'));
    const file = (name, data) => { const p = path.join(dir, name); fs.writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data)); return p; };
    const friend = file('friend.json', { pageFormat: 'half-letter', pages: [
        { id: 1, role: 'front-cover', elements: [] },
        { id: 2, role: 'inside', elements: [{ id: 5, type: 'text', x: 10, y: 10, w: 100, h: 40, rotation: 0, content: 'F1' }] },
        { id: 3, role: 'inside', elements: [{ id: 6, type: 'text', x: 10, y: 10, w: 100, h: 40, rotation: 0, content: 'F2' }] },
        { id: 4, role: 'back-cover', elements: [] }
    ] });
    const sheet = file('sheet.json', { pageFormat: 'single-page', pages: [{ id: 1, elements: [] }] });
    const broken = file('broken.json', '{ not json');

    assert('button shown for half-letter', !(await page.$eval('#import-pages-btn', b => b.hidden)));
    await page.setInputFiles('#import-pages-input', [friend, sheet, broken]);
    await page.waitForSelector('#save-notice');
    const notice = await page.$eval('#save-notice', n => n.textContent);
    assert('notice reports pages and names the skipped files', notice.includes('Imported 2 pages') && notice.includes('sheet.json') && notice.includes('broken.json'));
    assert('imported pages appended as inside pages', (await page.$$eval('.page-tab', els => els.map(e => e.textContent))).join() ===
        'Front cover,Your info,Page 1,Page 2,Page 3,Back cover');

    await page.evaluate(() => { while (insideIndexes(state.pages).length < 22) state.pages.splice(3, 0, { id: generateId(), role: 'inside', elements: [] }); render(); });
    await page.evaluate(() => document.getElementById('save-notice')?.remove());
    await page.setInputFiles('#import-pages-input', [friend]);
    await page.waitForSelector('#save-notice');
    assert('stops at 23 and reports the skipped page', (await page.$eval('#save-notice', n => n.textContent)).includes('skipped 1 (23-page limit)'));
    assert('23 inside pages', await page.evaluate(() => insideIndexes(state.pages).length === 23));

    await page.selectOption('#page-format', 'single-page');
    assert('button hidden for single-page', await page.$eval('#import-pages-btn', b => b.hidden));

    await close();
    done();
})();
