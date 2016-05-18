'use strict';

var Promise   = require('../util/promise');

module.exports = {
  then: function(callback, errback) {
    var self = this;
    if (!this._promise)
      this._promise = new Promise(function(resolve, reject) {
        self._resolve = resolve;
        self._reject  = reject;
      });

    if (arguments.length === 0)
      return this._promise;
    else
      return this._promise.then(callback, errback);
  },

  callback: function(callback, context) {
    return this.then(function(value) { callback.call(context, value) });
  },

  errback: function(callback, context) {
    return this.then(null, function(reason) { callback.call(context, reason) });
  },

  timeout: function(seconds, message) {
    this.then();
    var self = this;
    this._timer = global.setTimeout(function() {
      self._reject(message);
    }, seconds * 1000);
  },

  setDeferredStatus: function(status, value) {
    if (this._timer) global.clearTimeout(this._timer);

    this.then();

    if (status === 'succeeded')
      this._resolve(value);
    else if (status === 'failed')
      this._reject(value);
    else
      delete this._promise;
  }
};
