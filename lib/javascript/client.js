Faye.Client = Faye.Class({
  initialize: function(endpoint) {
    this._transport = new Faye.Transport(endpoint);
  },
  
  // TODO
  // * support various connection types
  // * take parameters for authentication
  connect: function() {
    this._transport.handshake(function(id) {
      this._clientId = id;
      this._transport.connect(id);
    }, this);
  },
  
  // TODO
  // * handle errors
  disconnect: function() {
    if (!this._clientId) return;
    this._transport.disconnect(this._clientId);
  }
});

