// fixedpages.js — booklet pages drawn from a file instead of the editor. With ?workshop the back
// cover is images/organizer/workshop.png (WorkshopBack); with ?workshop&opening-night both covers
// are opening night's (openingnight.js), which takes precedence. A fixed page has no tab, and
// shows in the Preview and the PDF. Whatever was drawn on it stays in the project and returns
// when the tool is opened without the mode.

const WorkshopBack = {
    src: 'images/organizer/workshop.png',   // 1650 × 2550 px fills the page

    replaces: function (slot) {
        return Mode.workshop && !Mode.openingNight && slot === 'back-cover';
    },

    // The image, fitted whole to the page (same layout as the opening-night poster)
    buildPage: function () {
        const page = document.createElement('div');
        page.className = 'opening-night-cover workshop-back';
        const img = document.createElement('img');
        img.alt = 'Ephemera Eternal workshop back cover';
        img.addEventListener('error', () => {
            page.textContent = '';
            const missing = document.createElement('p');
            missing.className = 'opening-night-missing';
            missing.textContent = 'Back cover image missing';
            page.appendChild(missing);
        });
        img.src = WorkshopBack.src;
        page.appendChild(img);
        return page;
    }
};

const FixedPages = {
    // True when this booklet slot is drawn by buildPage instead of the editor
    replaces: function (slot) {
        return OpeningNight.replaces(slot) || WorkshopBack.replaces(slot);
    },

    buildPage: function (slot) {
        return OpeningNight.replaces(slot) ? OpeningNight.buildPage(slot) : WorkshopBack.buildPage(slot);
    }
};
