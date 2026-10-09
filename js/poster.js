// poster.js — the fixed credit line along the bottom of every poster. Text comes from
// data/poster.json; like Glenn's info page it is never in state.pages, so it can't be
// selected, moved or deleted, and isn't in saved projects.

const Poster = {
    credit: '',

    init: function () {
        fetch('data/poster.json')
            .then(r => r.json())
            .then(data => {
                Poster.credit = data && typeof data.credit === 'string' ? data.credit.trim() : '';
                updateCanvasFormat();
            })
            .catch(() => { Poster.credit = ''; });
    }
};

// The credit strip for a poster sheet, or null when there is no credit text
function buildPosterCredit() {
    if (!Poster.credit) return null;
    const strip = document.createElement('div');
    strip.className = 'poster-credit';
    strip.textContent = Poster.credit;
    return strip;
}
