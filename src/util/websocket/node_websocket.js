'use strict';

var WS = require('faye-websocket').Client;

module.exports = {
  create: function(url, protocols, options) {
    return new WS(url, protocols, options);
  }
};
