'use strict';

module.exports = {
  addTimeout: function(name, delay, callback, context) {
    this._timeouts = this._timeouts || new Map();
    if (this._timeouts.has(name)) return;
    var self = this;
    this._timeouts.set(name, global.setTimeout(function() {
      delete self._timeouts[name];
      callback.call(context);
    }, 1000 * delay));
  },

  removeTimeout: function(name) {
    this._timeouts = this._timeouts || new Map();
    var timeout = this._timeouts.get(name);
    if (!timeout) return;
    global.clearTimeout(timeout);
    this._timeouts.delete(name);
  },

  removeAllTimeouts: function() {
    this._timeouts = this._timeouts || new Map();
    for (let name of this._timeouts.keys()) this.removeTimeout(name);
  }
};
