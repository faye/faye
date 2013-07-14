Faye.Server.Socket = Faye.Class({
  initialize: function(server, socket) {
    this._server = server;
    this._socket = socket;
  },

  send: function(message) {
    this._server.pipeThroughExtensions('outgoing', message, function(pipedMessage) {
      if (this._socket)
        this._socket.send(Faye.toJSON([pipedMessage]));
    }, this);
  },

  close: function() {
    if (this._socket) this._socket.close();
    delete this._socket;
  }
});

