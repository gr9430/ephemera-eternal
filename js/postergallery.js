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

const PosterGallery = {
    posters: [],
    store: '',

    init: function () {
        fetch('data/poster-gallery.json')
            .then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(data => {
                this.posters = usablePosters(data.posters);
                this.store = storeLink(data.storeUrl);
                this.render();
            })
            .catch(() => this.showMessage('Posters couldn’t load — please refresh.'));
    },

    showMessage: function (text) {
        const message = document.getElementById('gallery-message');
        message.textContent = text;
        message.hidden = false;
    },

    render: function () {
        const list = document.getElementById('poster-list');
        list.innerHTML = '';
        if (!this.posters.length) {
            this.showMessage('No posters yet.');
            return;
        }
        this.posters.forEach((poster, index) => list.appendChild(this.card(poster, index)));
    },

    card: function (poster, index) {
        const item = document.createElement('li');
        item.className = 'poster-card';
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'poster-open';
        open.setAttribute('aria-label', 'Larger view: ' + poster.title.trim());
        open.appendChild(this.image(poster, 'lazy'));
        item.appendChild(open);
        item.appendChild(this.info(poster));
        return item;
    },

    image: function (poster, loading) {
        const img = document.createElement('img');
        img.className = 'poster-img';
        img.loading = loading;
        img.decoding = 'async';
        img.alt = poster.alt;
        img.addEventListener('error', () => {
            const missing = document.createElement('span');
            missing.className = 'poster-missing';
            missing.textContent = poster.alt;
            img.replaceWith(missing);
        });
        img.src = poster.src;
        return img;
    },

    info: function (poster) {
        const box = document.createElement('div');
        box.className = 'poster-info';
        const title = document.createElement('h2');
        title.className = 'poster-title';
        title.textContent = poster.title.trim();
        box.appendChild(title);
        if (hasText(poster.details)) {
            const details = document.createElement('p');
            details.className = 'poster-details';
            details.textContent = poster.details.trim();
            box.appendChild(details);
        }
        const actions = document.createElement('div');
        actions.className = 'poster-actions';
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'btn btn-copy';
        copy.textContent = 'Copy title';
        copy.addEventListener('click', () => this.copyTitle(title, copy));
        actions.appendChild(copy);
        if (this.store) {
            const buy = document.createElement('a');
            buy.className = 'btn btn-buy';
            buy.href = this.store;
            buy.target = '_blank';
            buy.rel = 'noopener';
            buy.textContent = 'Buy →';
            actions.appendChild(buy);
        }
        box.appendChild(actions);
        return box;
    },

    // Clipboard first; where it's blocked (in-app browsers, plain http), select the title so the
    // visitor can copy it by hand.
    copyTitle: function (titleEl, button) {
        const copied = () => {
            button.textContent = 'Copied ✓';
            clearTimeout(button.resetTimer);
            button.resetTimer = setTimeout(() => { button.textContent = 'Copy title'; }, 2000);
        };
        const selectInstead = () => {
            const range = document.createRange();
            range.selectNodeContents(titleEl);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            button.textContent = 'Select & copy';
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(titleEl.textContent).then(copied, selectInstead);
        } else {
            selectInstead();
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { hasText, storeLink, validatePosters, usablePosters, stepIndex, swipeDirection };
}
