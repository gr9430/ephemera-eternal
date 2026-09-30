// generator.js — poetry generator panel: pick a symbol, generate a Tracery
// line, insert it as a text element or reroll; edit the grammar's word bank.

function addWordToGrammar(grammar, symbol, word) {
    const trimmed = word.trim();
    if (!trimmed) return grammar;
    if (!grammar[symbol]) grammar[symbol] = [];
    if (!grammar[symbol].includes(trimmed)) {
        grammar[symbol].push(trimmed);
    }
    return grammar;
}

const Generator = {
    _lastLine: '',
    _lastSymbol: 'origin',

    init: function () {
        fetch('data/grammar.json')
            .then(r => r.json())
            .then(data => {
                state.grammar = data;
                this.renderSymbolOptions();
                this.renderWordBank();
            })
            .catch(() => {
                // Keep store.js's default { origin: [] } grammar so the panel still renders.
                this.renderSymbolOptions();
                this.renderWordBank();
            });

        document.getElementById('generate-btn').addEventListener('click', () => this.generate());
        document.getElementById('insert-line-btn').addEventListener('click', () => this.insert());
        document.getElementById('word-bank-add-btn').addEventListener('click', () => this.addWord());
        document.getElementById('word-bank-symbol-select').addEventListener('change', () => this.renderWordBank());
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
    },

    addWord: function () {
        const symbol = document.getElementById('word-bank-symbol-select').value;
        const input = document.getElementById('word-bank-input');
        if (!symbol || !input.value.trim()) return;
        addWordToGrammar(state.grammar, symbol, input.value);
        input.value = '';
        this.renderWordBank();
    },

    renderWordBank: function () {
        const select = document.getElementById('word-bank-symbol-select');
        const list = document.getElementById('word-bank-list');
        const currentSelectValue = select.value;

        select.innerHTML = '';
        Object.keys(state.grammar).forEach(symbol => {
            const opt = document.createElement('option');
            opt.value = symbol;
            opt.textContent = symbol;
            select.appendChild(opt);
        });
        if (currentSelectValue && state.grammar[currentSelectValue]) {
            select.value = currentSelectValue;
        }

        const activeSymbol = select.value;
        list.innerHTML = '';
        (state.grammar[activeSymbol] || []).forEach(entry => {
            const li = document.createElement('li');
            li.textContent = entry;
            list.appendChild(li);
        });
    }
};
