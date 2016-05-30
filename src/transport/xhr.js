'use strict';

var Class     = require('../util/class'),
    URI       = require('../util/uri'),
    browser   = require('../util/browser'),
    extend    = require('../util/extend'),
    toJSON    = require('../util/to_json'),
    Transport = require('./transport');

var XHR = extend(Class(Transport, {
  encode: function(messages) {
    return toJSON(messages);
  },

  request: function(messages) {
    var href = this.endpoint.href,
        self = this,
        xhr;

    // Prefer XMLHttpRequest over ActiveXObject if they both exist
    if (global.XMLHttpRequest) {
      xhr = new XMLHttpRequest();
    } else if (global.ActiveXObject) {
      xhr = new ActiveXObject('Microsoft.XMLHTTP');
    } else {
      return this._handleError(messages);
    }

    xhr.open('POST', href, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Pragma', 'no-cache');
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

    var headers = this._dispatcher.headers;
    for (var key in headers) {
      if (!headers.hasOwnProperty(key)) continue;
      xhr.setRequestHeader(key, headers[key]);
    }

    var abort = function() { xhr.abort() };
    if (global.onbeforeunload !== undefined)
      browser.Event.on(global, 'beforeunload', abort);

    xhr.onreadystatechange = function() {
      if (!xhr || xhr.readyState !== 4) return;

      var replies    = null,
          status     = xhr.status,
          text       = xhr.responseText,
          successful = (status >= 200 && status < 300) || status === 304 || status === 1223;

      if (global.onbeforeunload !== undefined)
        browser.Event.detach(global, 'beforeunload', abort);

      xhr.onreadystatechange = function() {};
      xhr = null;

      if (!successful) return self._handleError(messages);

      try {
        replies = JSON.parse(text);
      } catch (error) {}

      if (replies)
        self._receive(replies);
      else
        self._handleError(messages);
    };

    xhr.send(this.encode(messages));
    return xhr;
  }
}), {
  isUsable: function(dispatcher, endpoint, callback, context) {
    var usable = (navigator.product === 'ReactNative')
              || URI.isSameOrigin(endpoint);

    callback.call(context, usable);
  }
});

module.exports = XHR;
