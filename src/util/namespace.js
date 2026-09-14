'use strict';

var Class  = require('./class'),
    random = require('./random');

module.exports = Class({
  initialize: function() {
    this._used = new Set();
  },

  exists: function(id) {
    return this._used.has(id);
  },

  generate: function() {
    var name = random();
    while (this._used.has(name)) name = random();
    this._used.add(name);
    return name;
  },

  release: function(id) {
    this._used.delete(id);
  }
});
