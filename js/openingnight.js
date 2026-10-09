// openingnight.js — opening-night mode for Glenn's opening-night zines. Opening the tool with
// ?opening-night turns it on: the front cover of a half-letter booklet becomes the show poster and
// the back cover a fixed page of text, both from data/opening-night.json (in the Preview and the
// PDF), and their tabs leave the editor. Whatever was drawn on either cover stays in the project
// and returns without ?opening-night.

const OPENING_NIGHT_SLOTS = ['front-cover', 'back-cover'];

const OpeningNight = {
    active: new URLSearchParams(location.search).has('opening-night'),
    paragraphs: null,
    frontCover: null,

    init: function () {
        if (!OpeningNight.active) return;
        document.getElementById('opening-night-badge').hidden = false;
        // no-cache: always check with the server, so an edited file (e.g. a new poster) shows at once
        fetch('data/opening-night.json', { cache: 'no-cache' })
            .then(r => r.json())
            .then(data => {
                OpeningNight.paragraphs = Array.isArray(data.paragraphs) ? data.paragraphs : null;
                OpeningNight.frontCover = typeof data.frontCover === 'string' && data.frontCover.trim() !== ''
                    ? data.frontCover.trim() : null;
            })
            .catch(() => { OpeningNight.paragraphs = null; OpeningNight.frontCover = null; });
    },

    // True when this booklet slot is drawn by buildPage instead of the editor
    replaces: function (slot) {
        return OpeningNight.active && OPENING_NIGHT_SLOTS.includes(slot);
    },

    buildPage: function (slot) {
        return slot === 'front-cover' ? OpeningNight.buildCover() : OpeningNight.buildBack();
    },

    // The show poster, fitted whole to the page
    buildCover: function () {
        const page = document.createElement('div');
        page.className = 'opening-night-cover';
        const showMissing = () => {
            page.textContent = '';
            const missing = document.createElement('p');
            missing.className = 'opening-night-missing';
            missing.textContent = 'Front cover image not set';
            page.appendChild(missing);
        };
        if (!OpeningNight.frontCover) {
            showMissing();
            return page;
        }
        const img = document.createElement('img');
        img.alt = 'Ephemera Eternal show poster';
        img.addEventListener('error', showMissing);
        img.src = OpeningNight.frontCover;
        page.appendChild(img);
        return page;
    },

    buildBack: function () {
        const page = document.createElement('div');
        page.className = 'opening-night-page';
        const paragraphs = OpeningNight.paragraphs || [];
        if (paragraphs.length === 0) {
            const missing = document.createElement('p');
            missing.className = 'opening-night-missing';
            missing.textContent = 'Opening night text not set';
            page.appendChild(missing);
        }
        paragraphs.forEach(text => {
            const p = document.createElement('p');
            p.textContent = text;
            page.appendChild(p);
        });
        return page;
    }
};
