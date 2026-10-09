// organizer.js — Glenn's info page, the inside back cover of every half-letter booklet.
// Content comes from data/organizer.json; participants never edit it. It appears only in
// the Preview's booklet view and in the PDF.

// The 🄯 glyph is missing from most fonts, so each one in the text is drawn as an inline SVG.
const COPYLEFT = '\u{1F12F}';

function copyleftIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'copyleft-icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '1em');
    svg.setAttribute('height', '1em');
    svg.setAttribute('aria-label', 'copyleft');
    const ring = document.createElementNS(ns, 'circle');
    ring.setAttribute('cx', '12');
    ring.setAttribute('cy', '12');
    ring.setAttribute('r', '10.5');
    const c = document.createElementNS(ns, 'path');
    c.setAttribute('d', 'M8.5 8.5 A5 5 0 1 1 8.5 15.5');
    [ring, c].forEach(shape => {
        shape.setAttribute('fill', 'none');
        shape.setAttribute('stroke', 'currentColor');
        shape.setAttribute('stroke-width', '2.2');
        svg.appendChild(shape);
    });
    return svg;
}

function buildOrganizerPage(organizer) {
    const page = document.createElement('div');
    page.className = 'organizer-page';
    const add = (tag, className, text) => {
        const el = document.createElement(tag);
        el.className = className;
        String(text).split(COPYLEFT).forEach((part, i) => {
            if (i > 0) {
                // keep the icon on the same line as the word after it
                const [, word, rest] = part.match(/^\s*(\S*)([\s\S]*)$/);
                const pair = document.createElement('span');
                pair.className = 'copyleft-pair';
                pair.appendChild(copyleftIcon());
                pair.appendChild(document.createTextNode(' ' + word));
                el.appendChild(pair);
                part = rest;
            }
            if (part) el.appendChild(document.createTextNode(part));
        });
        page.appendChild(el);
    };

    if (!organizer || typeof organizer.name !== 'string' || !organizer.name.trim()) {
        add('p', 'organizer-missing', 'Organizer info not set');
        return page;
    }
    if (organizer.image) {
        const img = document.createElement('img');
        img.className = 'organizer-image';
        img.src = organizer.image;
        img.alt = '';
        page.appendChild(img);
    }
    add('h2', 'organizer-name', organizer.name);
    if (organizer.role) add('p', 'organizer-role', organizer.role);
    (Array.isArray(organizer.lines) ? organizer.lines : []).forEach(line => add('p', 'organizer-line', line));
    (Array.isArray(organizer.links) ? organizer.links : []).forEach(link => add('p', 'organizer-link', link));
    return page;
}

const Organizer = {
    init: function () {
        fetch('data/organizer.json')
            .then(r => r.json())
            .then(data => { state.organizer = data; })
            .catch(() => { state.organizer = null; });
    }
};
