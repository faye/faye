'use strict';

var timeout = setTimeout, defer;

if (typeof process === 'object' && process.nextTick)
  defer = function(fn) { process.nextTick(fn) };
else if (typeof setImmediate === 'function')
  defer = function(fn) { setImmediate(fn) };
else
  defer = function(fn) { timeout(fn, 0) };

module.exports = defer;
