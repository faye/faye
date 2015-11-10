'use strict';

var Class  = require('../util/class'),
    toJSON = require('../util/to_json');

module.exports = Class({
  initialize: function(server, socket, request) {
    this._server  = server;
    this._socket  = socket;
    this._request = request;
  },

  send: function(message) {
    this._server.pipeThroughExtensions('outgoing', message, this._request, function(pipedMessage) {
      if (this._socket)
        this._socket.send(toJSON([pipedMessage]));
    }, this);
  },

  close: function() {
    if (this._socket) this._socket.close();
    delete this._socket;
  }
});
