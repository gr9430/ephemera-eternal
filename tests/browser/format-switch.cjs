// format-switch.cjs — switching format asks first when the pages hold anything; Cancel changes
// nothing; the info form's values carry over every switch.
'use strict';

const { open, assert, done } = require('./harness.cjs');
const QUESTION = "Switching format clears this zine's pages. Continue?";

(async () => {
    const { page, close } = await open();
    const dialogs = [];
    let answer = 'accept';
    page.removeAllListeners('dialog');
    page.on('dialog', d => { dialogs.push(d.message()); return answer === 'accept' ? d.accept() : d.dismiss(); });

    console.log('[empty zine: no question]');
    await page.selectOption('#page-format', 'poster-letter');
    assert('switched without asking', dialogs.length === 0 && await page.evaluate(() => state.pageFormat === 'poster-letter'));
    await page.selectOption('#page-format', 'half-letter');

    console.log('[info-form text only: no question]');
    await page.evaluate(() => {
        state.currentPage = state.pages.findIndex(p => p.role === 'their-info');
        render();
        state.meta.info.name = 'Bo';
        InfoForm.fill();
    });
    assert('the form put text on Your info', await page.evaluate(() => getCurrentPage().elements.some(e => e.fromInfoForm)));
    await page.selectOption('#page-format', 'poster-letter');
    assert('switched without asking', dialogs.length === 0 && await page.evaluate(() => state.pageFormat === 'poster-letter'));

    console.log('[content: asks, Cancel keeps everything]');
    await page.evaluate(() => addElement(Object.assign(createTextElement(100, 100), { content: 'keep me' })));
    answer = 'dismiss';
    await page.selectOption('#page-format', 'poster-legal');
    assert('asked once, with the message', dialogs.length === 1 && dialogs[0] === QUESTION);
    assert('format, dropdown and pages unchanged', await page.evaluate(() => state.pageFormat === 'poster-letter' &&
        document.getElementById('page-format').value === 'poster-letter' && getCurrentPage().elements.some(e => e.content === 'keep me')));

    console.log('[content: OK switches, info form carries over]');
    answer = 'accept';
    await page.selectOption('#page-format', 'half-letter');
    assert('asked again', dialogs.length === 2);
    assert('switched, pages cleared', await page.evaluate(() => state.pageFormat === 'half-letter' && !zineHasContent(state.pages)));
    await page.evaluate(() => { state.currentPage = state.pages.findIndex(p => p.role === 'their-info'); render(); });
    assert('the form still holds the name', await page.evaluate(() => state.meta.info.name === 'Bo') && (await page.inputValue('#info-name')) === 'Bo');

    await close();
    done();
})();
