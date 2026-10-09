// openingnight.js — opening-night mode for Glenn's opening-night zines. Opening the tool with
// ?opening-night turns it on: the back cover of a half-letter booklet becomes a fixed page of
// text from data/opening-night.json (in the Preview and the PDF), and its tab leaves the editor.
// Whatever was drawn on the back cover stays in the project and returns without ?opening-night.

const OpeningNight = {
    active: new URLSearchParams(location.search).has('opening-night'),
    paragraphs: null,

    init: function () {
        if (!OpeningNight.active) return;
        document.getElementById('opening-night-badge').hidden = false;
        fetch('data/opening-night.json')
            .then(r => r.json())
            .then(data => { OpeningNight.paragraphs = Array.isArray(data.paragraphs) ? data.paragraphs : null; })
            .catch(() => { OpeningNight.paragraphs = null; });
    },

    // True when this booklet slot is drawn by buildPage instead of the editor
    replaces: function (slot) {
        return OpeningNight.active && slot === 'back-cover';
    },

    buildPage: function () {
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
