'use strict';

var Class     = require('../util/class'),
    Set       = require('../util/set'),
    URI       = require('../util/uri'),
    extend    = require('../util/extend'),
    toJSON    = require('../util/to_json'),
    Transport = require('./transport');

var CORS = extend(Class(Transport, {
  encode: function(messages) {
    return 'message=' + encodeURIComponent(toJSON(messages));
  },

  request: function(messages) {
    var xhrClass = global.XDomainRequest ? XDomainRequest : XMLHttpRequest,
        xhr      = new xhrClass(),
        id       = ++CORS._id,
        headers  = this._dispatcher.headers,
        self     = this,
        key;

    xhr.open('POST', URI.stringify(this.endpoint), true);

    if (xhr.setRequestHeader) {
      xhr.setRequestHeader('Pragma', 'no-cache');
      for (key in headers) {
        if (!headers.hasOwnProperty(key)) continue;
        xhr.setRequestHeader(key, headers[key]);
      }
    }

    var cleanUp = function() {
      if (!xhr) return false;
      CORS._pending.remove(id);
      xhr.onload = xhr.onerror = xhr.ontimeout = xhr.onprogress = null;
      xhr = null;
    };

    xhr.onload = function() {
      var replies;
      try { replies = JSON.parse(xhr.responseText) } catch (error) {}

      cleanUp();

      if (replies)
        self._receive(replies);
      else
        self._handleError(messages);
    };

    xhr.onerror = xhr.ontimeout = function() {
      cleanUp();
      self._handleError(messages);
    };

    xhr.onprogress = function() {};

    if (xhrClass === global.XDomainRequest)
      CORS._pending.add({id: id, xhr: xhr});

    xhr.send(this.encode(messages));
    return xhr;
  }
}), {
  _id:      0,
  _pending: new Set(),

  isUsable: function(dispatcher, endpoint, callback, context) {
    if (URI.isSameOrigin(endpoint))
      return callback.call(context, false);

    if (global.XDomainRequest)
      return callback.call(context, endpoint.protocol === location.protocol);

    if (global.XMLHttpRequest) {
      var xhr = new XMLHttpRequest();
      return callback.call(context, xhr.withCredentials !== undefined);
    }
    return callback.call(context, false);
  }
});

module.exports = CORS;
