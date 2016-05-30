'use strict';

var WS = global.MozWebSocket || global.WebSocket;

module.exports = {
  create: function(url, protocols, options) {
    return new WS(url);
  }
};
