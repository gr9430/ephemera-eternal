// wordreview.js — Glenn's review of participants' consented words, shown only with ?organizer.
// A passphrase keeps curious participants out. Only its SHA-256 digest is in this file and the
// check runs in the page, so it deters rather than secures. Approved words are downloaded as a
// file and merged into data/grammar.json by hand; nothing here feeds the generator or Randomize.

const WORD_REVIEW_PASS_SHA256 = '6cf9cf427aa21396f536de70b00bf21b2865bb0edc1d991860c151dd759aa815';

async function sha256Hex(text) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const WordReview = {
    active: new URLSearchParams(location.search).has('organizer'),
    passHash: WORD_REVIEW_PASS_SHA256,
    downloadedIds: [],     // what the last download contained: only these may be cleared
    unlockedHere: false,   // fallback when sessionStorage is blocked

    init: function () {
        if (!WordReview.active) return;
        const modal = document.getElementById('word-review-modal');
        const btn = document.getElementById('word-review-btn');
        btn.hidden = false;
        btn.addEventListener('click', WordReview.open);
        document.getElementById('word-review-lock').addEventListener('submit', WordReview.unlock);
        document.getElementById('word-review-close-btn').addEventListener('click', WordReview.close);
        document.getElementById('word-review-download-btn').addEventListener('click', WordReview.download);
        document.getElementById('word-review-clear-btn').addEventListener('click', WordReview.clear);
        modal.addEventListener('click', e => { if (e.target === modal) WordReview.close(); });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && modal.classList.contains('show')) WordReview.close();
        });
    },

    // Remembered until the browser closes
    isUnlocked: function () {
        try {
            return WordReview.unlockedHere || sessionStorage.getItem('word-review-unlocked') === '1';
        } catch (e) {
            return WordReview.unlockedHere;
        }
    },

    open: async function () {
        document.getElementById('word-review-modal').classList.add('show');
        await WordReview.show();
    },

    // Fills the lists before revealing them, so the panel never shows an empty list first
    show: async function () {
        const unlocked = WordReview.isUnlocked();
        if (unlocked) await WordReview.render();
        document.getElementById('word-review-lock').hidden = unlocked;
        document.getElementById('word-review-body').hidden = !unlocked;
        if (!unlocked) document.getElementById('word-review-pass').focus();
    },

    unlock: async function (e) {
        e.preventDefault();
        const input = document.getElementById('word-review-pass');
        const ok = (await sha256Hex(input.value)) === WordReview.passHash;
        input.value = '';
        document.getElementById('word-review-wrong').hidden = ok;
        if (!ok) return;
        WordReview.unlockedHere = true;
        try { sessionStorage.setItem('word-review-unlocked', '1'); } catch (err) { /* this page only */ }
        await WordReview.show();
    },

    render: async function () {
        const entries = await WordStore.all();
        const fill = (listId, status, actions) => {
            const list = document.getElementById(listId);
            list.innerHTML = '';
            const shown = entries.filter(e => e.status === status);
            if (shown.length === 0) {
                const empty = document.createElement('li');
                empty.className = 'word-review-empty';
                empty.textContent = 'None';
                list.appendChild(empty);
            }
            shown.forEach(entry => {
                const li = document.createElement('li');
                li.dataset.id = entry.id;
                const text = document.createElement('span');
                text.className = 'word-review-text';
                text.textContent = entry.text;
                const when = document.createElement('span');
                when.className = 'word-review-when';
                when.textContent = new Date(entry.addedAt).toLocaleString();
                li.append(text, when);
                actions.forEach(([label, run]) => {
                    const b = document.createElement('button');
                    b.className = 'btn btn-tertiary';
                    b.textContent = label;
                    b.dataset.action = label.toLowerCase();
                    b.addEventListener('click', async () => { await run(entry); await WordReview.render(); });
                    li.appendChild(b);
                });
                list.appendChild(li);
            });
        };
        fill('word-review-pending', 'pending', [
            ['Approve', entry => WordStore.put(approveWordEntry(entry, new Date()))],
            ['Reject', entry => WordStore.remove(entry.id)]   // gone for good: "will not appear again"
        ]);
        fill('word-review-approved', 'approved', [
            ['Undo', entry => WordStore.put(unapproveWordEntry(entry))]
        ]);
    },

    download: async function () {
        const now = new Date();
        const entries = await WordStore.all();
        const file = approvedWordsFile(entries, now);
        WordReview.downloadedIds = entries.filter(e => e.status === 'approved').map(e => e.id);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
        link.download = approvedWordsFileName(now);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        document.getElementById('word-review-clear-btn').disabled = false;
    },

    clear: async function () {
        if (!confirm('Delete the downloaded words from this computer? Make sure the download worked first.')) return;
        // Words approved (or un-approved) since the download are in no file, so they stay
        const downloaded = new Set(WordReview.downloadedIds);
        const toClear = (await WordStore.all()).filter(e => e.status === 'approved' && downloaded.has(e.id));
        await Promise.all(toClear.map(e => WordStore.remove(e.id)));
        WordReview.downloadedIds = [];
        document.getElementById('word-review-clear-btn').disabled = true;
        await WordReview.render();
    },

    close: function () {
        document.getElementById('word-review-modal').classList.remove('show');
    }
};
