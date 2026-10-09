// addendum.js — the addendum: the first page inside every half-letter booklet's cover, facing
// Your info. Text comes from data/addendum.json; like Glenn's info page it is fixed, never in
// state.pages, and appears only in the Preview and the PDF.

const Addendum = {
    data: null,

    init: function () {
        fetch('data/addendum.json')
            .then(r => r.json())
            .then(data => { Addendum.data = data; })
            .catch(() => { Addendum.data = null; });
    }
};

function buildAddendumPage() {
    const page = document.createElement('div');
    page.className = 'addendum-page';
    const add = (tag, className, text) => {
        const el = document.createElement(tag);
        if (className) el.className = className;
        el.textContent = text;
        page.appendChild(el);
    };
    const data = Addendum.data;
    if (!data || !Array.isArray(data.paragraphs) || data.paragraphs.length === 0) {
        add('p', 'addendum-missing', 'Addendum text not set');
        return page;
    }
    if (data.heading) add('h2', 'addendum-heading', data.heading);
    data.paragraphs.forEach(text => add('p', '', text));
    return page;
}
