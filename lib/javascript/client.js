Faye.Client = Faye.Class({
  initialize: function(endpoint) {
    this._endpoint  = endpoint;
    this._transport = Faye.Transport.get(endpoint);
    Faye.Event.on(Faye.ENV, 'unload', this.disconnect, this);
  },
  
  // TODO
  // * support various connection types
  // * take parameters for authentication
  connect: function() {
    this._transport.handshake(function(response) {
      this._clientId = response.clientId;
      this._transport = Faye.Transport.get(this._endpoint, response.supportedConnectionTypes);
      this._transport.connect(this._clientId, function(message) {
        alert(message.clientId);
      });
    }, this);
  },
  
  // TODO
  // * handle errors
  disconnect: function() {
    if (!this._clientId) return;
    this._transport.disconnect(this._clientId);
  }
});

