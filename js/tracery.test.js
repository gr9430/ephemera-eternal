/**
 * tracery.test.js — Node.js test for the Tracery expansion engine (js/tracery.js), and for the
 * real data/grammar.json: every rule must expand without leaving markup in the text.
 * No DOM required.
 */

'use strict';

const fs = require('fs');
const path = require('path');

global.window = {};
eval(fs.readFileSync(path.join(__dirname, 'tracery.js'), 'utf8'));
const Tracery = window.Tracery;

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}

console.log('[single-option grammar is deterministic]');
var g1 = { origin: ['the #noun#'], noun: ['house'] };
assert('expands to "the house"', Tracery.expand(g1, 'origin') === 'the house');

console.log('\n[missing symbol falls back to bracketed name]');
var g2 = { origin: ['#missing#'] };
assert('unknown symbol renders as [missing]', Tracery.expand(g2, 'origin') === '[missing]');

console.log('\n[empty options array falls back to bracketed name]');
var g3 = { origin: [] };
assert('empty origin renders as [origin]', Tracery.expand(g3, 'origin') === '[origin]');

console.log('\n[nested symbols resolve recursively]');
var g4 = { origin: ['#a# #b#'], a: ['A'], b: ['B'] };
assert('expands both nested symbols', Tracery.expand(g4, 'origin') === 'A B');

console.log('\n[depth guard stops runaway recursion]');
var g5 = { origin: ['#origin#'] }; // self-referential — would recurse forever without the guard
var result = Tracery.expand(g5, 'origin');
assert('result contains a bracketed fallback rather than hanging', /\[origin\]/.test(result));

console.log('\n[modifiers]');
var g6 = { cap: ['#w.capitalize#'], all: ['#p.capitalizeAll#'], a1: ['#w.a#'], a2: ['#v.a#'], a3: ['#u.a#'],
    pl: ['#w.s#'], pl2: ['#x.s#'], both: ['#v.a.capitalize#'],
    w: ['block'], v: ['orange grove'], u: ['AME church'], x: ['church'], p: ['the old pub'] };
assert('.capitalize uppercases the first letter', Tracery.expand(g6, 'cap') === 'Block');
assert('.capitalizeAll uppercases every word', Tracery.expand(g6, 'all') === 'The Old Pub');
assert('.a gives "a" before a consonant', Tracery.expand(g6, 'a1') === 'a block');
assert('.a gives "an" before a vowel', Tracery.expand(g6, 'a2') === 'an orange grove');
assert('.a gives "an" before a capital vowel', Tracery.expand(g6, 'a3') === 'an AME church');
assert('.s pluralizes', Tracery.expand(g6, 'pl') === 'blocks' && Tracery.expand(g6, 'pl2') === 'churches');
assert('modifiers chain left to right', Tracery.expand(g6, 'both') === 'An orange grove');

console.log('\n[saved names: [name:#rule#] then #name#]');
var g7 = { origin: ['[v:#venue#]#v# was. #v# is. #v#.'], venue: ['Lou\'s', 'Will\'s', 'Wally\'s', 'the Beacham'] };
var saved = true;
for (var i = 0; i < 50; i++) {
    var parts = Tracery.expand(g7, 'origin').split(/ was\. | is\. /);
    if (parts.length !== 3 || parts[0] !== parts[1] || parts[2] !== parts[0] + '.') saved = false;
}
assert('a saved name repeats the same choice every time', saved);
var g8 = { origin: ['[n:#a#][n:#b#]#n#'], a: ['A'], b: ['B'] };
assert('a later save replaces an earlier one', Tracery.expand(g8, 'origin') === 'B');
var g9 = { origin: ['[c:#w#]#c.capitalize#'], w: ['word'] };
assert('modifiers work on saved names', Tracery.expand(g9, 'origin') === 'Word');
var g10 = { origin: ['#inner# #v#'], inner: ['[v:#w#]#v#'], w: ['x'], v: ['global'] };
assert('a save inside a rule ends with that rule', Tracery.expand(g10, 'origin') === 'x global');

console.log('\n[data/grammar.json expands cleanly]');
var grammar = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'grammar.json'), 'utf8'));
Object.keys(grammar).forEach(function (symbol) {
    var bad = null;
    for (var n = 0; n < 300 && !bad; n++) {
        var out = Tracery.expand(grammar, symbol);
        if (/[\[\]#]/.test(out)) bad = out;
    }
    assert('#' + symbol + '# never leaves [..] or # in the text' + (bad ? ' — e.g. ' + JSON.stringify(bad.slice(0, 120)) : ''), !bad);
});

console.log('\n[participant_pending is never expanded]');
var mentions = Object.keys(grammar).filter(function (symbol) {
    return grammar[symbol].some(function (rule) { return rule.indexOf('participant_pending') >= 0; });
});
assert('no rule mentions participant_pending' + (mentions.length ? ' — found in ' + mentions.join(', ') : ''), mentions.length === 0);

console.log('\n──────────────────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
