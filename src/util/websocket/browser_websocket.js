'use strict';

var WS = global.MozWebSocket || global.WebSocket;

module.exports = {
  create: function(url, protocols, options) {
    if (typeof WS !== 'function'
        // In Safari versions <= 9 it is an 'object'
        && typeof WS !== 'object') {
        return null;
    }
    return new WS(url);
  }
};
