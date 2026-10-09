// autosave.js — browser autosave (IndexedDB) and a "New" reset, ported from tools/ziner/index.html's
// Save State section. Only the zine itself is autosaved: pages, format, current page, and title/author.
// Grammar and the image panels are reloaded from data/*.json at startup, so they are not saved here;
// Save Project / Load Project (store.js) still round-trip the whole state.
//
// Workshop machines may be shared: "New" clears the canvas and deletes the autosave immediately,
// so facilitators can reset a machine between participants.

const Autosave = {
    DB_NAME: 'zine-workshop',
    DELAY: 600,
    NOT_SAVED_NOTE: 'Not saved: guide visibility, the selected element, text you are still editing, and Word Bank additions.',
    VALID_FORMATS: ['half-letter', 'single-page', 'stapled', 'poster-letter', 'poster-legal'],

    enabled: false,     // Stays off until the previous session has been restored
    available: true,
    timer: null,
    lastSnapshot: null,
    dbPromise: null,

    serialize: function () {
        return JSON.stringify({
            app: 'zine-workshop',
            version: 1,
            savedAt: new Date().toISOString(),
            pageFormat: state.pageFormat,
            currentPage: state.currentPage,
            meta: state.meta,
            pages: state.pages
        });
    },

    // Ignore the savedAt timestamp when checking for changes
    comparable: function (snapshot) {
        return snapshot.replace(/"savedAt":"[^"]*",/, '');
    },

    // Validates a parsed autosave and applies it to state. Throws on bad input.
    apply: function (data) {
        if (!data || data.app !== 'zine-workshop' || !Array.isArray(data.pages) || data.pages.length === 0) {
            throw new Error('Not a Zine Workshop autosave.');
        }
        let pages = data.pages.map((page, i) => {
            const restored = Object.assign({}, page);
            restored.id = page && page.id != null ? page.id : Date.now() + i;
            restored.elements = Array.isArray(page && page.elements) ? page.elements : [];
            return restored;
        });
        const pageFormat = Autosave.VALID_FORMATS.includes(data.pageFormat) ? data.pageFormat : 'half-letter';
        let currentPage = Math.min(Math.max(parseInt(data.currentPage, 10) || 0, 0), pages.length - 1);
        let dropped = 0;
        if (pageFormat === 'half-letter') {
            const migrated = migrateBookletState(pages, currentPage, () => Date.now() + Math.random());
            pages = migrated.pages;
            currentPage = migrated.currentPage;
            dropped = migrated.dropped;
        }

        state.pages = pages;
        state.pageFormat = pageFormat;
        state.currentPage = currentPage;
        const meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
        state.meta = {
            title: meta.title || '',
            author: meta.author || '',
            info: meta.info && typeof meta.info === 'object' ? Object.assign({}, meta.info) : {}
        };
        state.selectedId = null;
        state.editingId = null;
        state.dragState = null;
        state.resizeState = null;
        state.viewRotation = 0;
        document.getElementById('page-format').value = state.pageFormat;
        return { dropped };
    },

    openDB: function () {
        if (!Autosave.dbPromise) {
            Autosave.dbPromise = new Promise((resolve, reject) => {
                if (!window.indexedDB) {
                    reject(new Error('IndexedDB unavailable'));
                    return;
                }
                const request = indexedDB.open(Autosave.DB_NAME, 1);
                request.onupgradeneeded = () => request.result.createObjectStore('autosave');
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
        return Autosave.dbPromise;
    },

    request: async function (mode, action) {
        const db = await Autosave.openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('autosave', mode);
            const request = action(tx.objectStore('autosave'));
            tx.oncomplete = () => resolve(request.result);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    },

    schedule: function () {
        if (!Autosave.enabled || !Autosave.available) return;
        clearTimeout(Autosave.timer);
        Autosave.timer = setTimeout(Autosave.flush, Autosave.DELAY);
    },

    flush: async function () {
        clearTimeout(Autosave.timer);
        Autosave.timer = null;
        if (!Autosave.enabled || !Autosave.available) return;

        const snapshot = Autosave.serialize();
        const comparable = Autosave.comparable(snapshot);
        if (comparable === Autosave.lastSnapshot) return;

        try {
            await Autosave.request('readwrite', store => store.put(snapshot, 'current'));
            Autosave.lastSnapshot = comparable;
            Autosave.setStatus(`Autosaved ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
        } catch (error) {
            console.warn('Autosave failed:', error);
            const full = error && error.name === 'QuotaExceededError';
            Autosave.setStatus(full ? 'Autosave full: use Save Project' : 'Autosave failed: use Save Project', true);
        }
    },

    // Call before the first render()
    restore: async function () {
        let saved;
        try {
            saved = await Autosave.request('readonly', store => store.get('current'));
        } catch (error) {
            console.warn('Autosave unavailable:', error);
            Autosave.available = false;
            Autosave.setStatus('Autosave off: use Save Project', true);
            return;
        }

        Autosave.setStatus('Autosave on');
        if (saved) {
            try {
                const { dropped } = Autosave.apply(JSON.parse(saved));
                // One notice: a second showNotice() call would replace this one
                const droppedNote = dropped
                    ? `${dropped} page${dropped === 1 ? '' : 's'} beyond the ${MAX_STORED_INSIDE_PAGES}-page limit could not be restored. `
                    : '';
                Autosave.lastSnapshot = Autosave.comparable(saved);
                // A blank zine (e.g. saved right after New) restores silently
                const hasContent = state.pages.some(page => page.elements.length > 0 ||
                    (page.layers && Object.values(page.layers).some(layer => layer && layer.length > 0)));
                if (hasContent) {
                    Autosave.setStatus('Restored from autosave');
                    Autosave.showNotice(`Your last zine was restored from this browser's autosave. ${droppedNote}Press New to start fresh. ${Autosave.NOT_SAVED_NOTE}`);
                } else if (droppedNote) {
                    Autosave.showNotice(droppedNote.trim());
                }
            } catch (error) {
                console.warn('Could not restore autosave; starting fresh:', error);
            }
        }
        Autosave.enabled = true;
    },

    // Clears the canvas and deletes the autosave, e.g. between workshop participants
    startNew: async function () {
        if (!confirm('Start a new, blank zine? This clears the canvas and this browser\'s autosave. Anything not saved with Save Project will be lost.')) return;
        clearTimeout(Autosave.timer);
        Autosave.timer = null;
        state.pages = state.pageFormat === 'stapled'
            ? [{ id: 1, elements: [] }, { id: 2, elements: [] }]
            : state.pageFormat === 'half-letter'
                ? makeBookletPages(generateId)
                : [{ id: 1, elements: [] }];
        state.currentPage = 0;
        state.selectedId = null;
        state.editingId = null;
        state.viewRotation = 0;
        state.meta = { title: '', author: '', info: {} };

        if (Autosave.available) {
            try {
                await Autosave.request('readwrite', store => store.delete('current'));
                Autosave.lastSnapshot = null;
                Autosave.setStatus('Autosave cleared');
            } catch (error) {
                console.warn('Could not clear autosave:', error);
                Autosave.setStatus('Could not clear autosave', true);
            }
        }
        render();
    },

    setStatus: function (text, isWarning = false) {
        const status = document.getElementById('save-status');
        if (!status) return;
        status.textContent = text;
        status.classList.toggle('warning', isWarning);
        status.title = (Autosave.available
            ? 'Your zine autosaves in this browser only. Clearing browser data, private windows, or switching computers will lose it. Use Save Project to keep a copy. '
            : 'This browser is blocking autosave. Use Save Project to keep a copy. ') + Autosave.NOT_SAVED_NOTE;
    },

    showNotice: function (message) {
        const existing = document.getElementById('save-notice');
        if (existing) existing.remove();

        const notice = document.createElement('div');
        notice.id = 'save-notice';
        notice.className = 'save-notice';
        notice.setAttribute('role', 'status');
        const close = document.createElement('button');
        close.textContent = '✕';
        close.setAttribute('aria-label', 'Dismiss');
        close.addEventListener('click', () => notice.remove());
        notice.appendChild(close);
        notice.appendChild(document.createTextNode(message));
        document.body.appendChild(notice);
        setTimeout(() => notice.remove(), 8000);
    },

    init: function () {
        const newBtn = document.getElementById('new-zine-btn');
        if (newBtn) newBtn.addEventListener('click', Autosave.startNew);

        // Write any pending autosave before the tab is hidden or closed
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden' && Autosave.timer) {
                Autosave.flush();
            }
        });
    }
};
