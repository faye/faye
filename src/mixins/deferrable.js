'use strict';

module.exports = {
  then: function(callback, errback) {
    var self = this;

    if (!this._promise) {
      this._promise = new Promise(function(resolve, reject) {
        self._resolve = resolve;
        self._reject  = reject;
      });

      // Deferrables are consumed through callback()/errback(), so a deferrable that fails
      // with nobody listening must not reach the platform as an unhandled rejection. This
      // handler does not stop any other one from observing the rejection.
      this._promise.catch(function() {});
    }

    if (arguments.length === 0) {
      return this._promise;
    } else {
      return this._promise.then(callback, errback);
    }
  },

  callback: function(callback, context) {
    if (!callback) return;
    // the rejection handler keeps the derived promise from becoming an unhandled rejection
    // of its own when the deferrable fails
    return this.then(function(value) { callback.call(context, value) }, function() {});
  },

  errback: function(callback, context) {
    if (!callback) return;
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

    if (status === 'succeeded') {
      this._resolve(value);
    } else if (status === 'failed') {
      this._reject(value);
    } else {
      delete this._promise;
    }
  }
};
