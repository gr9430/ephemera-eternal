/**
 * tracery.test.js — Node.js test for the Tracery expansion engine.
 * No DOM required.
 */

'use strict';

let passed = 0, failed = 0;
function assert(label, cond) {
    if (cond) { passed++; console.log('  PASS: ' + label); }
    else { failed++; console.log('  FAIL: ' + label); }
}

var Tracery = {
  expand: function (grammar, symbol, depth) {
    depth = depth || 0;
    if (depth > 20) return '[' + symbol + ']';
    var options = grammar[symbol];
    if (!options || !options.length) return '[' + symbol + ']';
    var template = options[Math.floor(Math.random() * options.length)];
    var self = this;
    return template.replace(/#([^#]+)#/g, function (_, s) {
      return self.expand(grammar, s, depth + 1);
    });
  }
};

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

console.log('\n──────────────────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
