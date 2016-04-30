'use strict';

var Class  = require('./class'),
    random = require('./random');

module.exports = Class({
  initialize: function() {
    this._used = {};
  },

  exists: function(id) {
    return this._used.hasOwnProperty(id);
  },

  generate: function() {
    var name = random();
    while (this._used.hasOwnProperty(name))
      name = random();
    return this._used[name] = name;
  },

  release: function(id) {
    delete this._used[id];
  }
});
