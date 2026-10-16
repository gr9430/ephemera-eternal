// welcome.js — the public version's welcome: what the project is and how to make a zine, from
// data/public.json. It opens over the editor on the first visit, and How to in the top bar reopens
// it. Not shown with ?workshop, where a facilitator explains.

const WELCOME_SEEN_KEY = 'ee-welcome-seen';

const Welcome = {
    returnFocus: null,   // what had focus when How to opened it
    ready: null,         // set once init has started; resolves when the welcome is set up (or off)

    init: function () {
        Welcome.ready = Welcome.setup();
    },

    setup: async function () {
        const config = await loadPublicConfig();
        const welcome = config && config.welcome;
        if (!welcome || typeof welcome.heading !== 'string') return;
        Welcome.fill(welcome);
        const modal = document.getElementById('welcome-modal');
        const howTo = document.getElementById('how-to-btn');
        howTo.hidden = false;
        howTo.addEventListener('click', Welcome.open);
        document.getElementById('welcome-start-btn').addEventListener('click', Welcome.close);
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && modal.classList.contains('show')) Welcome.close();
        });
        if (!Welcome.seen()) Welcome.open();
    },

    fill: function (welcome) {
        const strings = list => (Array.isArray(list) ? list.filter(s => typeof s === 'string') : []);
        document.getElementById('welcome-title').textContent = welcome.heading;
        const paragraphs = document.getElementById('welcome-paragraphs');
        strings(welcome.paragraphs).forEach(text => {
            const p = document.createElement('p');
            p.className = 'booklet-export-note';
            p.textContent = text;
            paragraphs.appendChild(p);
        });
        const steps = document.getElementById('welcome-steps');
        strings(welcome.steps).forEach(text => {
            const li = document.createElement('li');
            li.textContent = text;
            steps.appendChild(li);
        });
    },

    // Blocked storage counts as not seen: the welcome just shows again next visit
    seen: function () {
        try {
            return localStorage.getItem(WELCOME_SEEN_KEY) === '1';
        } catch (e) {
            return false;
        }
    },

    open: function () {
        Welcome.returnFocus = document.activeElement;
        document.getElementById('welcome-modal').classList.add('show');
        document.getElementById('welcome-start-btn').focus();
    },

    close: function () {
        document.getElementById('welcome-modal').classList.remove('show');
        try { localStorage.setItem(WELCOME_SEEN_KEY, '1'); } catch (e) { /* shows again next visit */ }
        const back = Welcome.returnFocus;
        Welcome.returnFocus = null;
        if (back && back !== document.body && back.focus) back.focus();
        else document.getElementById('welcome-start-btn').blur();   // keys go back to the editor
    }
};
