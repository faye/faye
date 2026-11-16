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

  parse: function(url) {
    if (typeof url !== 'string') return url;
    return new URL(url);
  },

  stringify: function(uri) {
    return (typeof uri === 'string') ? uri : uri.href;
  },

  clone: function(url) {
    return this.parse(url.href);
  }
};
