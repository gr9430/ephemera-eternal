window.Tracery = {
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
