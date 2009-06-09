Faye.Client = Faye.Class({
  _UNCONNECTED:  {},
  _CONNECTING:   {},
  _CONNECTED:    {},
  
  initialize: function(endpoint) {
    this._endpoint  = endpoint;
    this._transport = Faye.Transport.get(this, endpoint);
    this._state     = this._UNCONNECTED;
    Faye.Event.on(Faye.ENV, 'unload', this.disconnect, this);
  },
  
  // TODO
  // * support various connection types
  // * take parameters for authentication
  // * add timeouts
  handshake: function() {
    if (this._state !== this._UNCONNECTED) return;
    this._state = this._CONNECTING;
    
    this._transport.send({
      channel:      Faye.Channel.HANDSHAKE,
      version:      Faye.BAYEUX_VERSION,
      supportedConnectionTypes: Faye.Transport.supportedConnectionTypes()
      
    }, function(message) {
      if (!message.successful) return;   // TODO retry
      this._clientId  = message.clientId;
      this._transport = Faye.Transport.get(this, this._endpoint, message.supportedConnectionTypes);
      this.connect();
    }, this);
  },
  
  connect: function() {
    if (!this._clientId) return this.handshake();
    
    this._transport.send({
      channel:        Faye.Channel.CONNECT,
      clientId:       this._clientId,
      connectionType: this._transport.connectionType
      
    }, function(message) {
      this._state = this._CONNECTED;
      alert(message.clientId);
    }, this);
  },
  
  // TODO
  // * handle errors
  disconnect: function() {
    if (this._state === this._UNCONNECTED) return;
    this._state = this._UNCONNECTED;
    
    this._transport.send({
      channel:  Faye.Channel.DISCONNECT,
      clientId: this._clientId
    });
  },
  
  // TODO might be better as a retry loop
  handleAdvice: function(advice) {
    var client = this;
    switch (advice.reconnect) {
      case 'retry':     setTimeout(function() {
                          client.connect();
                        }, advice.interval || Faye.Client.BACKOFF);
                        break;
      case 'handshake': client.handshake();
                        break;
      case 'none':
      default:          break;
    }
  }
});

Faye.extend(Faye.Client, {
  BACKOFF:  5000
});

