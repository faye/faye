Faye.Server.Socket = Faye.Class({
  initialize: function(server, socket, request) {
    this._server  = server;
    this._socket  = socket;
    this._request = request;
  },

  send: function(message) {
    this._server.pipeThroughExtensions('outgoing', message, this._request, function(pipedMessage) {
      if (this._socket)
        this._socket.send(Faye.toJSON([pipedMessage]));
    }, this);
  },

  close: function() {
    if (this._socket) this._socket.close();
    delete this._socket;
  }
});

