Faye.Client = Faye.Class({
  _UNCONNECTED: {},
  _CONNECTING:  {},
  _CONNECTED:   {},
  
  _HANDSHAKE:   'handshake',
  _RETRY:       'retry',
  _NONE:        'none',
  
  DEFAULT_ENDPOINT:   '<%= Faye::RackAdapter::DEFAULT_ENDPOINT %>',
  MAX_DELAY:          <%= Faye::Connection::MAX_DELAY %>,
  INTERVAL:           <%= Faye::Connection::INTERVAL * 1000 %>,
  
  initialize: function(endpoint) {
    this._endpoint  = endpoint || this.DEFAULT_ENDPOINT;
    this._transport = Faye.Transport.get(this);
    this._state     = this._UNCONNECTED;
    this._outbox    = [];
    this._channels  = new Faye.Channel.Tree();
    
    this._advice = {reconnect: this._HANDSHAKE, interval: this.INTERVAL};
    
    Faye.Event.on(Faye.ENV, 'beforeunload', this.disconnect, this);
  },
  
  generateId: function(bitdepth) {
    bitdepth = bitdepth || 32;
    return Math.floor(Math.pow(2,bitdepth) * Math.random()).toString(16);
  },
  
  // TODO
  // * support various connection types
  // * take parameters for authentication
  // * add timeouts
  handshake: function(callback, scope) {
    if (this._state !== this._UNCONNECTED) return;
    this._state = this._CONNECTING;
    
    var id = this.generateId();
    
    this._transport.send({
      channel:      Faye.Channel.HANDSHAKE,
      version:      Faye.BAYEUX_VERSION,
      supportedConnectionTypes: Faye.Transport.supportedConnectionTypes(),
      id:           id
      
    }, function(message) {
      if (message.id !== id) return;
      var self = this;
      
      if (!message.successful) {
        setTimeout(function() { self.handshake(callback, scope) }, this._advice.interval);
        return this._state = this._UNCONNECTED;
      }
      
      this._state     = this._CONNECTED;
      this._clientId  = message.clientId;
      this._transport = Faye.Transport.get(this, message.supportedConnectionTypes);
      
      if (callback) callback.call(scope);
    }, this);
  },
  
  connect: function(callback, scope) {
    if (!this._clientId) return this.handshake(function() {
      this.connect(callback, scope);
    }, this);
    
    if (this._advice.reconnect === this._NONE) return;
    if (this._state !== this._CONNECTED) return;
    
    if (this._connectionId) return;
    this._connectionId = this.generateId();
    
    this._transport.send({
      channel:        Faye.Channel.CONNECT,
      clientId:       this._clientId,
      connectionType: this._transport.connectionType,
      id:             this._connectionId
      
    }, function(message) {
      if (message.id !== this._connectionId) return;
      delete this._connectionId;
      
      var self = this;
      setTimeout(function() { self.connect() }, this._advice.interval);
    }, this);
    
    if (callback) callback.call(scope);
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
    
    this._channels = new Faye.Channel.Tree();
  },
  
  subscribe: function(channels, callback, scope) {
    if (this._state !== this._CONNECTED) return;
    
    channels = [].concat(channels);
    var id = this.generateId();
    
    Faye.each(channels, function(channel) {
      if (!Faye.Channel.isValid(channel))
        throw '"' + channel + '" is not a valid channel name';
      if (!Faye.Channel.isSubscribable(channel))
        throw 'Clients may not subscribe to channel "' + channel + '"';
    });
    
    this._transport.send({
      channel:      Faye.Channel.SUBSCRIBE,
      clientId:     this._clientId,
      subscription: channels,
      id:           id
    });
    
    Faye.each(channels, function(channel) {
      this._channels.set(channel, [callback, scope]);
    }, this);
  },
  
  // TODO support anonymous publishing
  publish: function(channel, data) {
    if (this._state !== this._CONNECTED) return;
    
    if (!Faye.Channel.isValid(channel))
      throw '"' + channel + '" is not a valid channel name';
    if (!Faye.Channel.isSubscribable(channel))
      throw 'Clients may not publish to channel "' + channel + '"';
    
    this.enqueue({
      channel:      channel,
      data:         data,
      clientId:     this._clientId
    });
    
    if (this._timeout) return;
    
    var self = this;
    this._timeout = setTimeout(function() {
      delete self._timeout;
      self.flush();
    }, this.MAX_DELAY * 1000);
  },
  
  enqueue: function(message) {
    this._outbox.push(message);
  },
  
  flush: function() {
    this._transport.send(this._outbox);
    this._outbox = [];
  },
  
  // TODO might be better as a retry loop
  handleAdvice: function(advice) {
    Faye.extend(this._advice, advice);
    if (this._advice.reconnect === this._HANDSHAKE) this._clientId = null;
  },
  
  sendToSubscribers: function(message) {
    var channels = this._channels.glob(message.channel);
    Faye.each(channels, function(callback) {
      callback[0].call(callback[1], message.data);
    });
  }
});

