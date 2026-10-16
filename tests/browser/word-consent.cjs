// word-consent.cjs — the "Add a word or line…" box: words land on the participant's page, consent
// stores them for review, anything else stores nothing, and stored words never reach the vocabulary.
'use strict';

const { open, assert, done } = require('./harness.cjs');

(async () => {
    const { page, close } = await open();
    const shown = () => page.$eval('#word-consent-modal', el => el.classList.contains('show'));
    const stored = () => page.evaluate(async () => (await WordStore.all()).map(e => `${e.status}:${e.text}`));
    const addWords = async (text) => {
        await page.fill('#word-entry', text);
        await page.click('#word-entry-add-btn');
    };

    console.log('[the box]');
    const box = await page.$eval('#word-entry', el => ({ tag: el.tagName, rows: el.rows, placeholder: el.placeholder }));
    assert('a 3-row text box saying "Add a word or line…"', box.tag === 'TEXTAREA' && box.rows === 3 && box.placeholder === 'Add a word or line…');
    assert('no category select and no word list', await page.evaluate(() =>
        !document.getElementById('word-bank-symbol-select') && !document.getElementById('word-bank-list') && !document.getElementById('word-bank-input')));

    console.log('[Add puts the words on the page and asks]');
    await addWords('the corner store remembers');
    assert('words are on the current page', await page.evaluate(() => getCurrentPage().elements.some(e => e.type === 'text' && e.content === 'the corner store remembers')));
    assert('box cleared', (await page.inputValue('#word-entry')) === '');
    assert('consent dialog opens', await shown());
    const dialog = await page.textContent('#word-consent-modal');
    assert('dialog quotes the words and says they will not appear again if denied',
        dialog.includes('May the algorithm reuse your words?') && dialog.includes('the corner store remembers') &&
        dialog.includes('If you deny consent, your words will not appear again.'));

    console.log('[keys pressed while the dialog is open]');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Delete');
    assert('Backspace / Delete do not erase the words behind the dialog', await page.evaluate(() =>
        getCurrentPage().elements.some(e => e.content === 'the corner store remembers')));
    assert('focus moves into the dialog', await page.evaluate(() => document.activeElement && document.activeElement.id === 'word-consent-yes-btn'));

    console.log('[I consent]');
    await page.click('#word-consent-yes-btn');
    await page.waitForFunction(async () => (await WordStore.all()).length === 1);
    assert('stored once, pending', JSON.stringify(await stored()) === JSON.stringify(['pending:the corner store remembers']));

    console.log('[I do not consent / Escape / outside click]');
    await addWords('keep this to myself');
    await page.click('#word-consent-no-btn');
    await addWords('escape hatch');
    await page.keyboard.press('Escape');
    await addWords('clicked away');
    await page.mouse.click(5, 5);
    await page.waitForTimeout(200);
    assert('dialog closed', !(await shown()));
    assert('nothing more stored', (await stored()).length === 1);
    assert('denied words still on the participant\'s page', await page.evaluate(() =>
        ['keep this to myself', 'escape hatch', 'clicked away'].every(t => getCurrentPage().elements.some(e => e.content === t))));

    console.log('[New keeps the stored words; they never reach the vocabulary]');
    await page.click('#new-zine-btn');
    await page.waitForTimeout(300);
    assert('store survives New', (await stored()).length === 1);
    assert('grammar does not contain stored words', await page.evaluate(() => !JSON.stringify(state.grammar).includes('the corner store remembers')));
    await page.waitForFunction(() => state.photoImages.length && state.clipartImages.length && state.grammar.slogan);
    assert('Randomize does not use stored words', await page.evaluate(() => {
        Randomize.apply();
        return !JSON.stringify(state.pages).includes('the corner store remembers');
    }));
    await page.evaluate(() => Randomize.finish());

    console.log('[storage unavailable]');
    await page.evaluate(() => { WordStore.add = () => Promise.reject(new Error('blocked')); });
    await addWords('private window words');
    await page.click('#word-consent-yes-btn');
    await page.waitForFunction(() => { const n = document.getElementById('save-notice'); return n && n.textContent.includes("Couldn't save"); });
    assert('notice says the words stay on the page', (await page.$eval('#save-notice', n => n.textContent))
        .includes("Couldn't save on this computer; your words stay on your page."));
    assert('words still on the page', await page.evaluate(() => getCurrentPage().elements.some(e => e.content === 'private window words')));

    await close();
    done();
})();
