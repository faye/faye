Faye.Client = Faye.Class({
  _UNCONNECTED:  {},
  _CONNECTING:   {},
  _CONNECTED:    {},
  
  initialize: function(endpoint) {
    this._endpoint  = endpoint;
    this._transport = Faye.Transport.get(endpoint);
    this._state     = this._UNCONNECTED;
    Faye.Event.on(Faye.ENV, 'unload', this.disconnect, this);
  },
  
  // TODO
  // * support various connection types
  // * take parameters for authentication
  // * add timeouts
  connect: function() {
    if (this._state !== this._UNCONNECTED) return;
    this._state = this._CONNECTING;
    
    this._transport.handshake(function(response) {
      this._clientId  = response.clientId;
      this._transport = Faye.Transport.get(this._endpoint, response.supportedConnectionTypes);
      
      this._transport.connect(this._clientId, function(message) {
        this._state = this._CONNECTED;
        alert(message.clientId);
      }, this);
    }, this);
  },
  
  // TODO
  // * handle errors
  disconnect: function() {
    if (this._state === this._UNCONNECTED) return;
    this._transport.disconnect(this._clientId);
    this._state = this._UNCONNECTED;
  }
});

