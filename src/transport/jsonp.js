'use strict';

var Class     = require('../util/class'),
    URI       = require('../util/uri'),
    toJSON    = require('../util/to_json'),
    Transport = require('./transport');

var JSONP = Object.assign(Class(Transport, {
  encode: function(messages) {
    var url = URI.clone(this.endpoint);
    url.searchParams.set('message', toJSON(messages));
    url.searchParams.set('jsonp', '__jsonp' + JSONP._cbCount + '__');
    return URI.stringify(url);
  },

  request: function(messages) {
    var head         = document.getElementsByTagName('head')[0],
        script       = document.createElement('script'),
        callbackName = JSONP.getCallbackName(),
        endpoint     = URI.clone(this.endpoint),
        self         = this;

    endpoint.searchParams.set('message', toJSON(messages));
    endpoint.searchParams.set('jsonp', callbackName);

    var cleanup = function() {
      if (!global[callbackName]) return false;
      global[callbackName] = undefined;
      try { delete global[callbackName] } catch (error) {}
      script.parentNode.removeChild(script);
    };

    global[callbackName] = function(replies) {
      cleanup();
      self._receive(replies);
    };

    script.type = 'text/javascript';
    script.src  = URI.stringify(endpoint);
    head.appendChild(script);

    script.onerror = function() {
      cleanup();
      self._handleError(messages);
    };

    return { abort: cleanup };
  }
}), {
  _cbCount: 0,

  getCallbackName: function() {
    this._cbCount += 1;
    return '__jsonp' + this._cbCount + '__';
  },

  isUsable: function(dispatcher, endpoint, callback, context) {
    callback.call(context, true);
  }
});

module.exports = JSONP;
