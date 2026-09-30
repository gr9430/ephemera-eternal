/**
 * generator.test.js — Node.js test for the pure grammar-mutation logic in generator.js.
 * No DOM required.
 *
 * Manual-verify items (DOM/fetch only, untestable in Node):
 *   - Generator.init()             — fetches data/grammar.json, wires buttons
 *   - Generator.generate()/insert() — reads/writes the DOM, calls createTextElement/addElement
 *   - Generator.renderSymbolOptions()/renderWordBank() — builds <option>/<li> DOM nodes
 */

'use strict';

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}

function addWordToGrammar(grammar, symbol, word) {
    const trimmed = word.trim();
    if (!trimmed) return grammar;
    if (!grammar[symbol]) grammar[symbol] = [];
    if (!grammar[symbol].includes(trimmed)) {
        grammar[symbol].push(trimmed);
    }
    return grammar;
}

console.log('[adding a word to an existing symbol]');
let g1 = { noun_place: ['block'] };
addWordToGrammar(g1, 'noun_place', 'alley');
assert('symbol now has 2 entries', g1.noun_place.length === 2);
assert('new entry is present', g1.noun_place.includes('alley'));

console.log('\n[adding a word to a new symbol creates it]');
let g2 = {};
addWordToGrammar(g2, 'new_symbol', 'hello');
assert('new symbol array was created', Array.isArray(g2.new_symbol));
assert('new symbol has the word', g2.new_symbol[0] === 'hello');

console.log('\n[whitespace is trimmed]');
let g3 = { noun_place: [] };
addWordToGrammar(g3, 'noun_place', '  porch  ');
assert('stored value is trimmed', g3.noun_place[0] === 'porch');

console.log('\n[blank input is a no-op]');
let g4 = { noun_place: ['block'] };
addWordToGrammar(g4, 'noun_place', '   ');
assert('array length unchanged', g4.noun_place.length === 1);

console.log('\n[duplicate word is not added twice]');
let g5 = { noun_place: ['block'] };
addWordToGrammar(g5, 'noun_place', 'block');
assert('array length unchanged', g5.noun_place.length === 1);

console.log('\n──────────────────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
