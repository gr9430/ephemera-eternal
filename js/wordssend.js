// wordssend.js — the public version's way to get consented words to Glenn. At Save as PDF, if
// data/public.json has an address and this browser holds pending words, it offers them: download a
// .txt to attach to an email, or open an email draft. Either one marks the words sent (the page
// can't know whether the person actually sent them). Not now leaves them pending, offered again
// at the next save.

const WordsSend = {
    address: '',
    ready: Promise.resolve(),   // init's config load; offer() waits for it
    offered: [],                // the entries in the open offer
    finish: null,               // resolves the open offer

    init: function () {
        WordsSend.ready = WordsSend.setup();
    },

    setup: async function () {
        const config = await loadPublicConfig();
        const address = config && typeof config.wordsEmail === 'string' ? config.wordsEmail.trim() : '';
        if (!/^[^\s@]+@[^\s@]+$/.test(address)) return;   // no address yet: no send step
        WordsSend.address = address;
        const modal = document.getElementById('words-send-modal');
        document.getElementById('words-send-download-btn').addEventListener('click', WordsSend.download);
        document.getElementById('words-send-email-btn').addEventListener('click', WordsSend.email);
        document.getElementById('words-send-later-btn').addEventListener('click', WordsSend.close);
        document.getElementById('words-send-continue-btn').addEventListener('click', WordsSend.close);
        modal.addEventListener('click', e => { if (e.target === modal) WordsSend.close(); });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && modal.classList.contains('show')) WordsSend.close();
        });
    },

    offer: async function () {
        await WordsSend.ready;
        if (!WordsSend.address) return;
        let pending;
        try {
            pending = (await WordStore.all()).filter(e => e.status === 'pending');
        } catch (e) {
            return;   // storage blocked: nothing was kept to send
        }
        if (pending.length === 0) return;

        WordsSend.offered = pending;
        const n = pending.length;
        document.getElementById('words-send-title').textContent =
            `You offered ${n} ${n === 1 ? 'word or line' : 'words or lines'} to the algorithm. Send them to Glenn?`;
        const list = document.getElementById('words-send-list');
        list.innerHTML = '';
        pending.forEach(entry => {
            const li = document.createElement('li');
            li.textContent = entry.text;
            list.appendChild(li);
        });
        const mailto = wordsMailto(WordsSend.address, pending, new Date());
        const email = document.getElementById('words-send-email-btn');
        email.hidden = !mailto;
        email.href = mailto || '#';
        document.getElementById('words-send-too-long').hidden = !!mailto;
        document.getElementById('words-send-choices').hidden = false;
        document.getElementById('words-send-attach').hidden = true;
        document.getElementById('words-send-modal').classList.add('show');
        document.getElementById('words-send-download-btn').focus();
        return new Promise(resolve => { WordsSend.finish = resolve; });
    },

    markSent: async function () {
        const now = new Date();
        try {
            await Promise.all(WordsSend.offered.map(entry => WordStore.put(markWordSent(entry, now))));
        } catch (e) { /* storage failed: they stay pending and are offered again */ }
    },

    download: async function () {
        const now = new Date();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([wordsTextFile(WordsSend.offered, now)], { type: 'text/plain' }));
        link.download = wordsTextFileName(now);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        await WordsSend.markSent();
        document.getElementById('words-send-attach-note').textContent = `Attach this file to an email to ${WordsSend.address}.`;
        document.getElementById('words-send-choices').hidden = true;
        document.getElementById('words-send-attach').hidden = false;
        document.getElementById('words-send-continue-btn').focus();
    },

    // The link itself opens the email draft; this marks the words and goes on to the PDF
    email: async function () {
        await WordsSend.markSent();
        WordsSend.close();
    },

    close: function () {
        document.getElementById('words-send-modal').classList.remove('show');
        const finish = WordsSend.finish;
        WordsSend.finish = null;
        WordsSend.offered = [];
        if (finish) finish();
    }
};
