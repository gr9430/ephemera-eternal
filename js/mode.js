// mode.js — which version of the tool this is, read once from the address. The plain URL is the
// public version, for people making a zine at home; workshop computers open ?workshop.
// ?opening-night and ?organizer only count together with ?workshop.

function readMode(search) {
    const params = new URLSearchParams(search);
    const workshop = params.has('workshop');
    return {
        workshop,
        openingNight: workshop && params.has('opening-night'),
        organizer: workshop && params.has('organizer')
    };
}

const Mode = readMode(typeof location !== 'undefined' ? location.search : '');

// How many inside pages a booklet may have: 11 at the workshop (16 pages in all, 4 sheets),
// 23 otherwise. Constants from booklet.js.
function maxInsidePages() {
    return Mode.workshop ? WORKSHOP_MAX_INSIDE_PAGES : MAX_INSIDE_PAGES;
}

// data/public.json, fetched once. Resolves null in workshop mode, or when the file is missing or
// unreadable, which turns the public-only features (welcome, sending words, print help) off.
let publicConfigPromise = null;
function loadPublicConfig() {
    if (!publicConfigPromise) {
        publicConfigPromise = Mode.workshop ? Promise.resolve(null)
            : fetch('data/public.json', { cache: 'no-cache' })
                .then(r => (r.ok ? r.json() : null))
                .then(data => (data && typeof data === 'object' && !Array.isArray(data) ? data : null))
                .catch(() => null);
    }
    return publicConfigPromise;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { readMode };
}
