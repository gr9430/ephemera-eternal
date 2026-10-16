// workshop-words.cjs — workshop computers with serve.py: a Yes goes into data/grammar.json through
// the words API, the review works on the server's lists, and without the server everything falls
// back to this browser's storage. The API is faked with page.route; serve_test.py tests serve.py.
'use strict';

const { open, assert, done } = require('./harness.cjs');
const TEST_PHRASE = 'test-only passphrase';

// A stand-in for serve.py's words API, keeping its lists in memory
async function fakeServer(page, words = { pending: [], approved: [] }) {
    const calls = [];
    await page.route('**/api/words**', route => {
        const req = route.request();
        const action = new URL(req.url()).pathname.split('/api/words')[1].replace('/', '') || (req.method() === 'POST' ? 'add' : 'list');
        const text = req.method() === 'POST' ? JSON.parse(req.postData()).text : null;
        calls.push(action);
        if (action === 'add' && text.trim().length > 500) {
            return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Empty, or longer than 500 characters' }) });
        }
        const move = (from, to) => {
            if (!words[from].includes(text)) return;
            words[from] = words[from].filter(t => t !== text);
            if (to) words[to].push(text);
        };
        if (action === 'add' && !words.pending.includes(text.trim())) words.pending.push(text.trim());
        if (action === 'approve') move('pending', 'approved');
        if (action === 'reject') move('pending', null);
        if (action === 'unapprove') move('approved', 'pending');
        route.fulfill({ contentType: 'application/json', body: JSON.stringify(Object.assign({ ok: true }, words)) });
    });
    return { words, calls };
}

(async () => {
    console.log('[workshop with the server: Yes goes to grammar.json]');
    let session = await open();
    let page = session.page;
    let server = await fakeServer(page);
    const consent = async (text, answer = '#word-consent-yes-btn') => {
        await page.fill('#word-entry', text);
        await page.click('#word-entry-add-btn');
        await page.click(answer);
        await page.waitForTimeout(200);
    };
    const local = () => page.evaluate(async () => (await WordStore.all()).map(e => e.text));
    const notice = () => page.evaluate(() => { const n = document.getElementById('save-notice'); return n ? n.textContent : ''; });
    await consent('the corner store remembers');
    assert('sent to the server as pending', JSON.stringify(server.words.pending) === '["the corner store remembers"]');
    assert('not kept in this browser', (await local()).length === 0);
    assert('no notice', (await notice()) === '');
    await consent('keep this to myself', '#word-consent-no-btn');
    assert('no consent: nothing sent', server.calls.filter(c => c === 'add').length === 1);
    await consent('x'.repeat(501));
    assert('too long: says so', (await notice()).includes('500 characters'));
    assert('too long: not kept anywhere', server.words.pending.length === 1 && (await local()).length === 0);
    assert('the words stay on the page', await page.evaluate(() => getCurrentPage().elements.some(e => e.content === 'x'.repeat(501))));

    console.log('[the generator never offers pending lines]');
    const symbols = await page.evaluate(() => {
        state.grammar.participant = ['an approved line'];
        state.grammar.participant_pending = ['not reviewed yet'];
        Generator.renderSymbolOptions();
        return [...document.querySelectorAll('#generator-symbol-select option')].map(o => o.value);
    });
    assert('participant_pending is not in the symbol list', !symbols.includes('participant_pending'));
    assert('participant is', symbols.includes('participant'));
    await session.close();

    console.log('[workshop without the server: this computer only]');
    session = await open();
    page = session.page;
    await consent('first words');
    assert('kept in this browser, pending', JSON.stringify(await page.evaluate(async () => (await WordStore.all()).map(e => `${e.status}:${e.text}`))) ===
        '["pending:first words"]');
    assert('says so', (await notice()).includes('Words saved on this computer only.'));
    await page.evaluate(() => document.getElementById('save-notice').remove());
    await consent('second words');
    assert('says it once per visit', (await notice()) === '');
    assert('both kept', (await local()).length === 2);
    await session.close();

    console.log('[public: Yes never calls the server]');
    session = await open(undefined, '');
    page = session.page;
    await page.waitForSelector('#welcome-modal.show');
    await page.click('#welcome-start-btn');
    server = await fakeServer(page);
    await consent('public words');
    assert('no API call', server.calls.length === 0);
    assert('kept in this browser', JSON.stringify(await local()) === '["public words"]');
    await session.close();

    console.log('[review against the server]');
    session = await open(undefined, '?workshop&organizer');
    page = session.page;
    server = await fakeServer(page, { pending: ['first line', 'second line'], approved: ['old line'] });
    await page.evaluate(async phrase => { WordReview.passHash = await sha256Hex(phrase); }, TEST_PHRASE);
    await page.evaluate(() => WordStore.add('from a workshop without the server'));   // an earlier backlog
    await page.click('#word-review-btn');
    await page.fill('#word-review-pass', TEST_PHRASE);
    await page.click('#word-review-lock button[type="submit"]');
    await page.waitForFunction(() => !document.getElementById('word-review-body').hidden);
    const items = id => page.$$eval(`#${id} li[data-id]`, lis => lis.map(li => li.querySelector('.word-review-text').textContent));
    const act = async (listId, text, action) => {
        await page.evaluate(({ listId, text, action }) => {
            const li = [...document.querySelectorAll(`#${listId} li[data-id]`)].find(l => l.querySelector('.word-review-text').textContent === text);
            li.querySelector(`button[data-action="${action}"]`).click();
        }, { listId, text, action });
        await page.waitForTimeout(200);
    };
    assert('lists the server\'s lines', JSON.stringify(await items('word-review-pending')) === '["first line","second line"]' &&
        JSON.stringify(await items('word-review-approved')) === '["old line"]');
    assert('no download or clear with the server', await page.$eval('#word-review-download-btn', b => b.hidden) &&
        await page.$eval('#word-review-clear-btn', b => b.hidden));
    assert('says the lines are in data/grammar.json', (await page.textContent('#word-review-source')).includes('data/grammar.json'));
    assert('and that this browser still holds 1 word of its own', (await page.textContent('#word-review-source')).includes('This browser also holds 1 word'));
    await act('word-review-pending', 'first line', 'approve');
    await act('word-review-pending', 'second line', 'reject');
    await act('word-review-approved', 'old line', 'undo');
    assert('approve, reject and undo reach the server', JSON.stringify(server.words) === '{"pending":["old line"],"approved":["first line"]}');
    assert('and the lists follow', JSON.stringify(await items('word-review-pending')) === '["old line"]' &&
        JSON.stringify(await items('word-review-approved')) === '["first line"]');
    await session.close();

    done();
})();
