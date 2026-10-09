// wordentry.js — the "Add a word or line…" box. The words go onto the participant's own page right
// away; then they are asked whether the algorithm may reuse them. Consent stores them as pending
// for Glenn's review (wordstore.js); no, Escape or clicking away stores nothing.

const WordEntry = {
    waiting: null,   // the words waiting on the consent answer

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
            await WordStore.add(text);
        } catch (e) {
            Autosave.showNotice("Couldn't save on this computer; your words stay on your page.");
        }
    }
};
