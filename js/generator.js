// generator.js — poetry generator panel: pick a symbol, generate a Tracery line, insert it as a
// text element or reroll.

const Generator = {
    _lastLine: '',
    _lastSymbol: 'origin',

    init: function () {
        fetch('data/grammar.json')
            .then(r => r.json())
            .then(data => {
                state.grammar = data;
                this.renderSymbolOptions();
            })
            .catch(() => {
                // Keep store.js's default { origin: [] } grammar so the panel still renders.
                this.renderSymbolOptions();
            });

        document.getElementById('generate-btn').addEventListener('click', () => this.generate());
        document.getElementById('insert-line-btn').addEventListener('click', () => this.insert());
    },

    renderSymbolOptions: function () {
        const select = document.getElementById('generator-symbol-select');
        select.innerHTML = '';
        Object.keys(state.grammar).forEach(symbol => {
            const opt = document.createElement('option');
            opt.value = symbol;
            opt.textContent = symbol;
            select.appendChild(opt);
        });
        select.value = 'origin' in state.grammar ? 'origin' : Object.keys(state.grammar)[0] || '';
    },

    generate: function () {
        const symbol = document.getElementById('generator-symbol-select').value;
        if (!symbol) return;
        this._lastSymbol = symbol;
        this._lastLine = Tracery.expand(state.grammar, symbol);
        document.getElementById('generator-output').textContent = this._lastLine;
        document.getElementById('insert-line-btn').disabled = false;
    },

    insert: function () {
        if (!this._lastLine) return;
        const element = createTextElement(120, 120);
        element.content = this._lastLine;
        addElement(element);
    }
};
