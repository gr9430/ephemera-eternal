// infoform.js — the "Your info" page form for half-letter booklets. Values live in
// state.meta.info (autosaved and saved with the project). "Fill in page" turns them into
// ordinary text elements tagged fromInfoForm, each in a random font (readable ones for
// everything but the name); filling in again replaces only those (and draws new fonts).

const InfoForm = {
    FIELDS: ['name', 'contact', 'date', 'note'],

    info: function () {
        if (!state.meta.info || typeof state.meta.info !== 'object') state.meta.info = {};
        return state.meta.info;
    },

    init: function () {
        InfoForm.FIELDS.forEach(field => {
            document.getElementById('info-' + field).addEventListener('input', (e) => {
                if (field === 'note' && InfoForm.info().randomized) {   // locked after Randomize
                    e.target.value = RANDOMIZED_NOTE;
                    return;
                }
                InfoForm.info()[field] = e.target.value;
                Autosave.schedule();
            });
        });
        document.getElementById('info-fill-btn').addEventListener('click', InfoForm.fill);
    },

    render: function () {
        const panel = document.getElementById('info-form-panel');
        const page = getCurrentPage();
        panel.hidden = !(state.pageFormat === 'half-letter' && page && page.role === 'their-info');
        if (panel.hidden) return;

        const info = InfoForm.info();
        // Default to today once; a date the participant cleared stays cleared
        if (!('date' in info)) info.date = new Date().toLocaleDateString();
        InfoForm.FIELDS.forEach(field => {
            const input = document.getElementById('info-' + field);
            if (document.activeElement !== input) input.value = info[field] || '';
        });
        const note = document.getElementById('info-note');
        note.readOnly = Boolean(info.randomized);
        if (info.randomized) note.value = RANDOMIZED_NOTE;
    },

    // The big name can take any font; contact, date and note stay in readable ones
    randomFont: function (field) {
        const fonts = field === 'name' ? Object.keys(state.fonts) : randomFontLists(fontSources, state.fonts).readable;
        return fonts[Math.floor(Math.random() * fonts.length)];
    },

    // The form's fields as text elements on top of the page's own (locked ones stay put on the canvas)
    elements: function (pageElements, info) {
        return replaceInfoFormElements(pageElements || [], infoFormLayout(info), spec =>
            Object.assign(createTextElement(spec.x, spec.y), {
                w: spec.w, h: spec.h, fontSize: spec.fontSize, bold: spec.bold,
                content: spec.content, rotation: 0, fromInfoForm: true,
                font: InfoForm.randomFont(spec.field)
            }, spec.locked ? { locked: true } : {}));
    },

    fill: function () {
        const page = getCurrentPage();
        page.elements = InfoForm.elements(page.elements, InfoForm.info());
        state.selectedId = null;
        state.editingId = null;
        render();
    }
};
