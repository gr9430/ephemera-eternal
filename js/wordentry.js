// wordentry.js — the "Add a word or line…" box. The words go onto the participant's own page right
// away; then they are asked whether the algorithm may reuse them. Consent stores them as pending
// for Glenn's review: at a workshop running serve.py, in data/consented-words.json; otherwise in
// this browser (wordstore.js). No, Escape or clicking away stores nothing.

const WordEntry = {
    waiting: null,   // the words waiting on the consent answer
    warnedLocal: false,   // "this computer only" is said once per visit

    init: function () {
        const modal = document.getElementById('word-consent-modal');
        document.getElementById('word-entry-add-btn').addEventListener('click', WordEntry.add);
        document.getElementById('word-consent-yes-btn').addEventListener('click', () => WordEntry.answer(true));
        document.getElementById('word-consent-no-btn').addEventListener('click', () => WordEntry.answer(false));
        modal.addEventListener('click', e => { if (e.target === modal) WordEntry.answer(false); });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && modal.classList.contains('show')) WordEntry.answer(false);
        });
    },

    add: function () {
        const box = document.getElementById('word-entry');
        const text = box.value.trim();
        if (!text) return;
        box.value = '';
        const fonts = randomFontLists(fontSources, state.fonts).readable;
        addElement(Object.assign(createTextElement(100, 100), {
            content: text, w: 300, h: 80, font: fonts[Math.floor(Math.random() * fonts.length)]
        }));
        WordEntry.waiting = text;
        document.getElementById('word-consent-quote').textContent = `“${text}”`;
        document.getElementById('word-consent-modal').classList.add('show');
        document.getElementById('word-consent-yes-btn').focus();
    },

    answer: async function (consented) {
        document.getElementById('word-consent-modal').classList.remove('show');
        const text = WordEntry.waiting;
        WordEntry.waiting = null;
        if (!consented || !text) return;
        try {
            if (Mode.workshop && await WordEntry.sendToServer(text)) return;
            await WordStore.add(text);
        } catch (e) {
            Autosave.showNotice("Couldn't save on this computer; your words stay on your page.");
        }
    },

    // serve.py puts the words in data/consented-words.json, pending Glenn's review. True when the server
    // dealt with them (took them, or refused them with a notice); false when there's no server,
    // e.g. plain http.server or ?workshop on the live site, and the words go to this browser.
    sendToServer: async function (text) {
        let response = null;
        try {
            response = await fetch('api/words', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text })
            });
        } catch (e) { /* no server */ }
        if (response && response.ok) return true;
        if (response && response.status === 400) {
            const refusal = await response.json().catch(() => null);
            if (refusal && refusal.error) {
                Autosave.showNotice('Those words are too long for the algorithm (500 characters at most). They stay on your page.');
                return true;
            }
        }
        if (!WordEntry.warnedLocal) {
            WordEntry.warnedLocal = true;
            Autosave.showNotice('Words saved on this computer only. You can also email them to workshop@gsr.mozmail.com');
        }
        return false;
    }
};
