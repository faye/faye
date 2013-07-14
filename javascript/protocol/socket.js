Faye.Server.Socket = Faye.Class({
  initialize: function(server, socket) {
    this._server = server;
    this._socket = socket;
  },

  send: function(message) {
    this._server.pipeThroughExtensions('outgoing', message, function(pipedMessage) {
      this._socket.send(Faye.toJSON([pipedMessage]));
    }, this);
  },

  close: function() {
    this._socket.close();
  }
});

