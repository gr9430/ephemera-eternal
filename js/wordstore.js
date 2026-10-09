// wordstore.js — participants' consented words, kept in this browser's IndexedDB apart from the
// zine autosave, so they survive New. Nothing here feeds the generator or Randomize: Glenn reviews
// entries in the organizer view (wordreview.js) and merges approved ones into data/grammar.json by
// hand. The entry and export helpers are pure (Node-tested); WordStore wraps the IndexedDB calls.

function makeWordEntry(text, now, id) {
    return { id, text: String(text).trim(), status: 'pending', addedAt: now.toISOString() };
}

function approveWordEntry(entry, now) {
    return Object.assign({}, entry, { status: 'approved', approvedAt: now.toISOString() });
}

function unapproveWordEntry(entry) {
    const copy = Object.assign({}, entry, { status: 'pending' });
    delete copy.approvedAt;
    return copy;
}

function approvedWordsFile(entries, now) {
    return {
        app: 'zine-workshop',
        kind: 'approved-words',
        exportedAt: now.toISOString(),
        words: entries.filter(e => e.status === 'approved').map(e => ({ text: e.text, addedAt: e.addedAt, approvedAt: e.approvedAt }))
    };
}

function approvedWordsFileName(now) {
    const pad = n => String(n).padStart(2, '0');
    return `approved-words-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

const WordStore = {
    DB: 'zine-workshop-words',
    STORE: 'entries',
    dbPromise: null,

    open: function () {
        if (!WordStore.dbPromise) {
            WordStore.dbPromise = new Promise((resolve, reject) => {
                const req = indexedDB.open(WordStore.DB, 1);
                req.onupgradeneeded = () => req.result.createObjectStore(WordStore.STORE, { keyPath: 'id' });
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            WordStore.dbPromise.catch(() => { WordStore.dbPromise = null; });   // let a later call retry
        }
        return WordStore.dbPromise;
    },

    request: async function (mode, action) {
        const db = await WordStore.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(WordStore.STORE, mode);
            const req = action(tx.objectStore(WordStore.STORE));
            tx.oncomplete = () => resolve(req && req.result);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    },

    add: function (text) {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        return WordStore.request('readwrite', store => store.put(makeWordEntry(text, new Date(), id)));
    },

    all: async function () {
        const list = await WordStore.request('readonly', store => store.getAll());
        return (list || []).sort((a, b) => a.addedAt.localeCompare(b.addedAt));
    },

    put: entry => WordStore.request('readwrite', store => store.put(entry)),
    remove: id => WordStore.request('readwrite', store => store.delete(id))
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { makeWordEntry, approveWordEntry, unapproveWordEntry, approvedWordsFile, approvedWordsFileName };
}
