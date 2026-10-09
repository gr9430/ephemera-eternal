// word-review.cjs — Glenn's review of consented words: ?organizer only, passphrase (remembered for
// the session), approve / reject / undo, the approved-words download and clearing.
'use strict';

const fs = require('fs');
const { open, assert, done } = require('./harness.cjs');
const TEST_PHRASE = 'test-only passphrase';   // the real one never appears in the repo

(async () => {
    let session = await open();
    assert('no Review words button on the normal address', await session.page.$eval('#word-review-btn', b => b.hidden));
    await session.close();

    session = await open(undefined, '?organizer');
    const page = session.page;
    // Swap in the digest of a throwaway phrase so this file never needs Glenn's real one
    await page.evaluate(async (phrase) => { WordReview.passHash = await sha256Hex(phrase); }, TEST_PHRASE);
    await page.evaluate(async () => {
        for (const text of ['first line', 'second line', 'third line']) {
            await WordStore.add(text);
            await new Promise(r => setTimeout(r, 5));   // distinct addedAt for ordering
        }
    });
    const items = id => page.$$eval(`#${id} li[data-id]`, lis => lis.map(li => li.querySelector('.word-review-text').textContent));
    const act = async (listId, text, action) => {
        await page.evaluate(({ listId, text, action }) => {
            const li = [...document.querySelectorAll(`#${listId} li[data-id]`)].find(l => l.querySelector('.word-review-text').textContent === text);
            li.querySelector(`button[data-action="${action}"]`).click();
        }, { listId, text, action });
        await page.waitForTimeout(150);
    };

    console.log('[passphrase]');
    assert('Review words button shown with ?organizer', !(await page.$eval('#word-review-btn', b => b.hidden)));
    await page.click('#word-review-btn');
    assert('asks for the passphrase first', !(await page.$eval('#word-review-lock', f => f.hidden)) && await page.$eval('#word-review-body', b => b.hidden));
    await page.fill('#word-review-pass', 'not the passphrase');
    await page.click('#word-review-lock button[type="submit"]');
    await page.waitForTimeout(150);
    assert('wrong phrase refused', !(await page.$eval('#word-review-wrong', p => p.hidden)) && await page.$eval('#word-review-body', b => b.hidden));
    assert('says "That\'s not it."', (await page.textContent('#word-review-wrong')).includes("That's not it."));
    await page.fill('#word-review-pass', TEST_PHRASE);
    await page.click('#word-review-lock button[type="submit"]');
    await page.waitForFunction(() => !document.getElementById('word-review-body').hidden);
    assert('right phrase opens the review', JSON.stringify(await items('word-review-pending')) === JSON.stringify(['first line', 'second line', 'third line']));

    console.log('[approve / reject / undo]');
    await act('word-review-pending', 'first line', 'approve');
    await act('word-review-pending', 'second line', 'reject');
    assert('approved moves over', JSON.stringify(await items('word-review-approved')) === '["first line"]');
    assert('rejected is deleted from the store', await page.evaluate(async () => (await WordStore.all()).map(e => e.text).join() === 'first line,third line'));
    await act('word-review-approved', 'first line', 'undo');
    assert('undo puts it back in pending', (await items('word-review-approved')).length === 0 && (await items('word-review-pending')).includes('first line'));
    await act('word-review-pending', 'first line', 'approve');

    console.log('[session memory]');
    await page.click('#word-review-close-btn');
    await page.click('#word-review-btn');
    assert('no second prompt in the same session', await page.$eval('#word-review-lock', f => f.hidden) && !(await page.$eval('#word-review-body', b => b.hidden)));

    console.log('[download approved]');
    assert('Clear downloaded starts disabled', await page.$eval('#word-review-clear-btn', b => b.disabled));
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#word-review-download-btn')]);
    assert('file name approved-words-YYYY-MM-DD.json', /^approved-words-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()));
    const file = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert('only approved words, documented shape', file.app === 'zine-workshop' && file.kind === 'approved-words' &&
        file.words.length === 1 && file.words[0].text === 'first line' && file.words[0].addedAt && file.words[0].approvedAt);

    console.log('[clear downloaded]');
    assert('Clear enabled after a download', !(await page.$eval('#word-review-clear-btn', b => b.disabled)));
    await act('word-review-pending', 'third line', 'approve');   // approved after the download: in no file yet
    await page.click('#word-review-clear-btn');   // harness accepts the confirm prompt
    await page.waitForTimeout(200);
    assert('clears only what was downloaded; a word approved afterwards survives', await page.evaluate(async () =>
        (await WordStore.all()).map(e => `${e.status}:${e.text}`).join() === 'approved:third line'));
    assert('Clear disabled again until the next download', await page.$eval('#word-review-clear-btn', b => b.disabled));

    await session.close();

    console.log('[a fresh browser asks again]');
    session = await open(undefined, '?organizer');
    assert('the shipped digest is set (64 hex chars)', await session.page.evaluate(() => /^[0-9a-f]{64}$/.test(WordReview.passHash)));
    await session.page.click('#word-review-btn');
    assert('prompt shown in a new session', !(await session.page.$eval('#word-review-lock', f => f.hidden)));
    await session.close();
    done();
})();
