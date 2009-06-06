Faye.Client = Faye.Class({
  initialize: function(endpoint) {
    this._transport = new Faye.Transport(endpoint);
  },
  
  // TODO take parameters for authentication
  connect: function() {
    this._transport.send({
      channel:    Faye.Channel.HANDSHAKE,
      version:    Faye.BAYEUX_VERSION,
      supportedConnectionTypes: ['long-polling']
    }, function(message) {
      this._clientId = message.clientId;
    }, this);
  }
});

