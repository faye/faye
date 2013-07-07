(function() {
'use strict';

var defer;
if (typeof setImmediate === 'function')
  defer = setImmediate;
else if (typeof process === 'object' && process.nextTick)
  defer = process.nextTick;
else
  defer = function(fn) { setTimeout(fn, 0) };

var PENDING   = 0,
    FULFILLED = 1,
    REJECTED  = 2;

var FORWARD = function(x) { return x },
    BREAK   = function(x) { throw x  };

var Promise = function(task) {
  this._state     = PENDING;
  this._callbacks = [];
  this._errbacks  = [];

  if (typeof task !== 'function') return;
  var self = this;

  task(function(value)  { fulfill(self, value) },
       function(reason) { reject(self, reason) });
};

Promise.prototype.then = function(callback, errback) {
  var self = this;
  return new Promise(function(fulfill, reject) {
    var next = {fulfill: fulfill, reject: reject};
    registerCallback(self, callback, next);
    registerErrback(self, errback, next);
  });
};

var registerCallback = function(promise, callback, next) {
  if (typeof callback !== 'function') callback = FORWARD;
  var handler = function(value) { invoke(callback, value, next) };
  if (promise._state === PENDING) {
    promise._callbacks.push(handler);
  } else if (promise._state === FULFILLED) {
    handler(promise._value);
  }
};

var registerErrback = function(promise, errback, next) {
  if (typeof errback !== 'function') errback = BREAK;
  var handler = function(reason) { invoke(errback, reason, next) };
  if (promise._state === PENDING) {
    promise._errbacks.push(handler);
  } else if (promise._state === REJECTED) {
    handler(promise._reason);
  }
};

var invoke = function(fn, value, next) {
  defer(function() {
    try {
      var outcome = fn(value);
      if (outcome && typeof outcome.then === 'function') {
        outcome.then(next.fulfill, next.reject);
      } else {
        next.fulfill(outcome);
      }
    } catch (error) {
      next.reject(error);
    }
  });
};

var fulfill = Promise.fulfill = function(promise, value) {
  if (promise._state !== PENDING) return;
  promise._state = FULFILLED;
  transition(promise, value);
};

var reject = Promise.reject = function(promise, reason) {
  if (promise._state !== PENDING) return;
  promise._state = REJECTED;
  transition(promise, reason);
};

var transition = function(promise, value) {
  var callbacks, ignored, cb;
  if (promise._state === FULFILLED) {
    promise._value = value;
    callbacks      = promise._callbacks;
    ignored        = promise._errbacks;
  } else if (promise._state === REJECTED) {
    promise._reason = value;
    callbacks       = promise._errbacks;
    ignored         = promise._callbacks;
  }
  while (cb = callbacks.shift()) cb(value);
  ignored.length = 0;
};

Promise.pending = function() {
  var tuple = {};

  tuple.promise = new Promise(function(fulfill, reject) {
    tuple.fulfill = fulfill;
    tuple.reject  = reject;
  });
  return tuple;
};

Promise.fulfilled = function(value) {
  return new Promise(function(fulfill, reject) { fulfill(value) });
};

Promise.rejected = function(reason) {
  return new Promise(function(fulfill, reject) { reject(reason) });
};

if (typeof Faye === 'undefined')
  module.exports = Promise;
else
  Faye.Promise = Promise;

})();

