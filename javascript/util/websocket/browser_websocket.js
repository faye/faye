'use strict';

var WS = window.MozWebSocket || window.WebSocket;

module.exports = {
  create: function(url, protocols, options) {
    return new WS(url);
  }
};
