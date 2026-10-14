// tracery.js — expands data/grammar.json the way Tracery does:
//   #symbol#                 a random option of symbol, itself expanded
//   #symbol.mod.mod#         modifiers, applied left to right: capitalize, capitalizeAll, a, s
//   [name:#rule#]            saves one expansion of rule as name; #name# then repeats it. The save
//                            lasts for the rest of the rule it's in (and the rules that rule uses).
// A symbol with no options comes out as [symbol], so a gap in the grammar is visible.
window.Tracery = {
  modifiers: {
    capitalize: function (s) { return s.charAt(0).toUpperCase() + s.slice(1); },
    capitalizeAll: function (s) { return s.replace(/(^|\s)(\S)/g, function (_, sp, c) { return sp + c.toUpperCase(); }); },
    a: function (s) { return (/^[aeiou]/i.test(s) ? 'an ' : 'a ') + s; },
    s: function (s) {
      if (/(s|x|z|ch|sh)$/i.test(s)) return s + 'es';
      if (/[^aeiou]y$/i.test(s)) return s.slice(0, -1) + 'ies';
      return s + 's';
    }
  },

  expand: function (grammar, symbol, depth, saved) {
    depth = depth || 0;
    if (depth > 20) return '[' + symbol + ']';
    var options = grammar[symbol];
    if (!options || !options.length) return '[' + symbol + ']';
    var template = options[Math.floor(Math.random() * options.length)];
    return this.render(grammar, template, depth, Object.create(saved || null));
  },

  // Expands one template; saved holds this rule's [name:...] saves, on top of its parents'
  render: function (grammar, text, depth, saved) {
    var out = '';
    var i = 0;
    while (i < text.length) {
      var ch = text.charAt(i);
      if (ch === '[') {
        var end = this.closing(text, i);
        var body = end < 0 ? '' : text.slice(i + 1, end);
        var colon = body.indexOf(':');
        if (end < 0 || colon < 0) { out += ch; i++; continue; }
        saved[body.slice(0, colon)] = this.render(grammar, body.slice(colon + 1), depth + 1, saved);
        i = end + 1;
      } else if (ch === '#') {
        var close = text.indexOf('#', i + 1);
        if (close < 0) { out += text.slice(i); break; }
        out += this.tag(grammar, text.slice(i + 1, close), depth, saved);
        i = close + 1;
      } else {
        out += ch;
        i++;
      }
    }
    return out;
  },

  // Index of the ] that closes the [ at start, allowing nested [ ]; -1 if there isn't one
  closing: function (text, start) {
    var level = 0;
    for (var j = start; j < text.length; j++) {
      if (text.charAt(j) === '[') level++;
      else if (text.charAt(j) === ']' && --level === 0) return j;
    }
    return -1;
  },

  tag: function (grammar, tag, depth, saved) {
    var parts = tag.split('.');
    var name = parts[0];
    var value = name in saved ? saved[name] : this.expand(grammar, name, depth + 1, saved);
    for (var k = 1; k < parts.length; k++) {
      var mod = this.modifiers[parts[k]];
      if (mod) value = mod(value);
    }
    return value;
  }
};
