'use strict';

var Class = require('./class');

module.exports = Class({
  initialize: function() {
    this._index = new Map();
  },

  add: function(item) {
    var key = (item.id !== undefined) ? item.id : item;
    if (this._index.has(key)) return false;
    this._index.set(key, item);
    return true;
  },

  [Symbol.iterator]: function() {
    return this._index.values();
  },

  isEmpty: function() {
    return this._index.size === 0;
  },

  member: function(item) {
    for (let value of this._index.values()) {
      if (value === item) return true;
    }
    return false;
  },

  remove: function(item) {
    var key = (item.id !== undefined) ? item.id : item;
    var removed = this._index.get(key);
    this._index.delete(key);
    return removed;
  }
});
