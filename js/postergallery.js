// postergallery.js — the public poster gallery (posters.html): Glenn's show posters and one shared
// store link. Visitors copy a poster's exact title and enter it at the store; price and
// availability live on the storefront. The helpers below are pure (Node-tested); PosterGallery
// builds the page and the full-screen viewer.

const POSTER_REQUIRED = ['id', 'title', 'src', 'alt'];
const SWIPE_MIN = 50;

function hasText(v) {
    return typeof v === 'string' && v.trim() !== '';
}

function storeLink(url) {
    if (typeof url !== 'string') return '';
    const u = url.trim();
    return /^https?:\/\/\S+$/i.test(u) ? u : '';
}

function validatePosters(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return ['poster-gallery.json must be an object with storeUrl and posters'];
    }
    const errors = [];
    if (typeof data.storeUrl !== 'string' || (data.storeUrl.trim() !== '' && !storeLink(data.storeUrl))) {
        errors.push('storeUrl must be empty or an http(s) URL with no spaces');
    }
    if (!Array.isArray(data.posters)) {
        errors.push('posters must be a list');
        return errors;
    }
    const ids = new Set(), titles = new Set();
    data.posters.forEach((p, i) => {
        const name = p && hasText(p.id) ? p.id : 'entry ' + i;
        POSTER_REQUIRED.forEach(f => {
            if (!p || !hasText(p[f])) errors.push(name + ': missing ' + f);
        });
        if (!p) return;
        if (p.details !== undefined && typeof p.details !== 'string') errors.push(name + ': details must be text');
        if (hasText(p.id)) {
            if (ids.has(p.id)) errors.push(name + ': duplicate id');
            ids.add(p.id);
        }
        if (hasText(p.title)) {
            const key = p.title.trim().toLowerCase();
            if (titles.has(key)) errors.push(name + ': duplicate title "' + p.title.trim() + '"');
            titles.add(key);
        }
    });
    return errors;
}

function usablePosters(list) {
    return Array.isArray(list) ? list.filter(p => p && POSTER_REQUIRED.every(f => hasText(p[f]))) : [];
}

function stepIndex(index, delta, count) {
    const next = index + delta;
    return next >= 0 && next < count ? next : index;
}

function swipeDirection(dx, dy) {
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) <= 1.5 * Math.abs(dy)) return 0;
    return dx < 0 ? 1 : -1;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { hasText, storeLink, validatePosters, usablePosters, stepIndex, swipeDirection };
}
