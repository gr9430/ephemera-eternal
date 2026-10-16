// printhelp.js — the public version's Print & fold steps, shown once a PDF has saved, for people
// printing at home without a facilitator. The steps for each kind of PDF ('duplex', 'two-pass',
// 'sheet', 'poster') are in data/public.json under printHelp.

const PrintHelp = {
    steps: null,

    init: async function () {
        const config = await loadPublicConfig();
        if (!config || !config.printHelp || typeof config.printHelp !== 'object') return;
        PrintHelp.steps = config.printHelp;
        const modal = document.getElementById('print-help-modal');
        document.getElementById('print-help-done-btn').addEventListener('click', PrintHelp.close);
        modal.addEventListener('click', e => { if (e.target === modal) PrintHelp.close(); });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && modal.classList.contains('show')) PrintHelp.close();
        });
    },

    show: function (kind) {
        const steps = PrintHelp.steps && PrintHelp.steps[kind];
        if (!Array.isArray(steps) || steps.length === 0) return;
        const list = document.getElementById('print-help-steps');
        list.innerHTML = '';
        steps.filter(s => typeof s === 'string').forEach(text => {
            const li = document.createElement('li');
            li.textContent = text;
            list.appendChild(li);
        });
        document.getElementById('print-help-modal').classList.add('show');
        document.getElementById('print-help-done-btn').focus();
    },

    close: function () {
        document.getElementById('print-help-modal').classList.remove('show');
    }
};
