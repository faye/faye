'use strict';

module.exports = {
  isURI: function(uri) {
    return uri && uri.protocol && uri.host && uri.pathname;
  },

  isSameOrigin: function(uri) {
    return uri.protocol === location.protocol &&
           uri.hostname === location.hostname &&
           uri.port     === location.port;
  },

  parse: function(url, base) {
    if (typeof url !== 'string') return url;

    if (typeof location === 'undefined') {
      return new URL(url, base);
    } else {
      return new URL(url, base || location.href);
    }
  },

  stringify: function(uri) {
    return (typeof uri === 'string') ? uri : uri.href;
  },

  clone: function(url) {
    return this.parse(url.href);
  }
};
