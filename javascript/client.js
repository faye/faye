Faye.Client = Faye.Class({
  UNCONNECTED:   1,
  CONNECTING:    2,
  CONNECTED:     3,
  DISCONNECTED:  4,
  
  HANDSHAKE:     'handshake',
  RETRY:         'retry',
  NONE:          'none',
  
  DEFAULT_ENDPOINT:   '<%= Faye::RackAdapter::DEFAULT_ENDPOINT %>',
  MAX_DELAY:          <%= Faye::Connection::MAX_DELAY %>,
  INTERVAL:           <%= Faye::Connection::INTERVAL * 1000 %>,
  
  initialize: function(endpoint) {
    this._endpoint  = endpoint || this.DEFAULT_ENDPOINT;
    this._transport = Faye.Transport.get(this);
    this._state     = this.UNCONNECTED;
    this._namespace = new Faye.Namespace();
    this._outbox    = [];
    this._channels  = new Faye.Channel.Tree();
    this._callbacks = [];
    
    this._advice = {reconnect: this.RETRY, interval: this.INTERVAL};
    
    if (!Faye.Event) return;
    Faye.Event.on(Faye.ENV, 'beforeunload', this.disconnect, this);
  },
  
  // Request
  // MUST include:  * channel
  //                * version
  //                * supportedConnectionTypes
  // MAY include:   * minimumVersion
  //                * ext
  //                * id
  // 
  // Success Response                             Failed Response
  // MUST include:  * channel                     MUST include:  * channel
  //                * version                                    * successful
  //                * supportedConnectionTypes                   * error
  //                * clientId                    MAY include:   * supportedConnectionTypes
  //                * successful                                 * advice
  // MAY include:   * minimumVersion                             * version
  //                * advice                                     * minimumVersion
  //                * ext                                        * ext
  //                * id                                         * id
  //                * authSuccessful
  handshake: function(callback, scope) {
    if (this._advice.reconnect === this.NONE) return;
    if (this._state !== this.UNCONNECTED) return;
    
    this._state = this.CONNECTING;
    var self = this;
    
    this._transport.send({
      channel:      Faye.Channel.HANDSHAKE,
      version:      Faye.BAYEUX_VERSION,
      supportedConnectionTypes: Faye.Transport.supportedConnectionTypes()
      
    }, function(response) {
      
      if (!response.successful) {
        setTimeout(function() { self.handshake(callback, scope) }, this._advice.interval);
        return this._state = this.UNCONNECTED;
      }
      
      this._state     = this.CONNECTED;
      this._clientId  = response.clientId;
      this._transport = Faye.Transport.get(this, response.supportedConnectionTypes);
      
      if (callback) callback.call(scope);
    }, this);
  },
  
  // Request                              Response
  // MUST include:  * channel             MUST include:  * channel
  //                * clientId                           * successful
  //                * connectionType                     * clientId
  // MAY include:   * ext                 MAY include:   * error
  //                * id                                 * advice
  //                                                     * ext
  //                                                     * id
  //                                                     * timestamp
  connect: function(callback, scope) {
    if (this._advice.reconnect === this.NONE) return;
    
    if (this._advice.reconnect === this.HANDSHAKE || this._state === this.UNCONNECTED)
      return this.handshake(function() { this.connect(callback, scope) }, this);
    
    if (this._state === this.CONNECTING)
      return this._callbacks.push([callback, scope]);
    
    if (this._state !== this.CONNECTED) return;
    
    if (callback) callback.call(scope);
    
    Faye.each(this._callbacks, function(listener) {
      listener[0].call(listener[1]);
    });
    this._callbacks = [];
    
    if (this._connectionId) return;
    this._connectionId = this._namespace.generate();
    var self = this;
    
    this._transport.send({
      channel:        Faye.Channel.CONNECT,
      clientId:       this._clientId,
      connectionType: this._transport.connectionType,
      id:             this._connectionId
      
    }, function(response) {
      delete this._connectionId;
      setTimeout(function() { self.connect() }, this._advice.interval);
    }, this);
  },
  
  // Request                              Response
  // MUST include:  * channel             MUST include:  * channel
  //                * clientId                           * successful
  // MAY include:   * ext                                * clientId
  //                * id                  MAY include:   * error
  //                                                     * ext
  //                                                     * id
  disconnect: function() {
    if (this._state !== this.CONNECTED) return;
    this._state = this.DISCONNECTED;
    
    this._transport.send({
      channel:      Faye.Channel.DISCONNECT,
      clientId:     this._clientId
    });
    
    this._channels = new Faye.Channel.Tree();
  },
  
  // Request                              Response
  // MUST include:  * channel             MUST include:  * channel
  //                * clientId                           * successful
  //                * subscription                       * clientId
  // MAY include:   * ext                                * subscription
  //                * id                  MAY include:   * error
  //                                                     * advice
  //                                                     * ext
  //                                                     * id
  //                                                     * timestamp
  subscribe: function(channels, callback, scope) {
    if (this._state !== this.CONNECTED) return;
    
    channels = [].concat(channels);
    this._validateChannels(channels);
    
    this._transport.send({
      channel:      Faye.Channel.SUBSCRIBE,
      clientId:     this._clientId,
      subscription: channels
      
    }, function(response) {
      if (!response.successful) return;
      
      channels = [].concat(response.subscription);
      Faye.each(channels, function(channel) {
        this._channels.set(channel, [callback, scope]);
      }, this);
    }, this);
  },
  
  // Request                              Response
  // MUST include:  * channel             MUST include:  * channel
  //                * clientId                           * successful
  //                * subscription                       * clientId
  // MAY include:   * ext                                * subscription
  //                * id                  MAY include:   * error
  //                                                     * advice
  //                                                     * ext
  //                                                     * id
  //                                                     * timestamp
  unsubscribe: function(channels, callback, scope) {
    if (this._state !== this.CONNECTED) return;
    
    channels = [].concat(channels);
    this._validateChannels(channels);
    
    this._transport.send({
      channel:      Faye.Channel.UNSUBSCRIBE,
      clientId:     this._clientId,
      subscription: channels
      
    }, function(response) {
      if (!response.successful) return;
      
      channels = [].concat(response.subscription);
      Faye.each(channels, function(channel) {
        this._channels.set(channel, null);
      }, this);
    }, this);
  },
  
  // Request                              Response
  // MUST include:  * channel             MUST include:  * channel
  //                * data                               * successful
  // MAY include:   * clientId            MAY include:   * id
  //                * id                                 * error
  //                * ext                                * ext
  publish: function(channel, data) {
    if (this._state !== this.CONNECTED) return;
    this._validateChannels([channel]);
    
    this._enqueue({
      channel:      channel,
      data:         data,
      clientId:     this._clientId
    });
    
    if (this._timeout) return;
    var self = this;
    
    this._timeout = setTimeout(function() {
      delete self._timeout;
      self._flush();
    }, this.MAX_DELAY * 1000);
  },
  
  _enqueue: function(message) {
    this._outbox.push(message);
  },
  
  _flush: function() {
    this._transport.send(this._outbox);
    this._outbox = [];
  },
  
  _validateChannels: function(channels) {
    Faye.each(channels, function(channel) {
      if (!Faye.Channel.isValid(channel))
        throw '"' + channel + '" is not a valid channel name';
      if (!Faye.Channel.isSubscribable(channel))
        throw 'Clients may not subscribe to channel "' + channel + '"';
    });
  },
  
  _handleAdvice: function(advice) {
    Faye.extend(this._advice, advice);
    if (this._advice.reconnect === this.HANDSHAKE) this._clientId = null;
  },
  
  _sendToSubscribers: function(message) {
    var channels = this._channels.glob(message.channel);
    Faye.each(channels, function(callback) {
      if (!callback) return;
      callback[0].call(callback[1], message.data);
    });
  }
});

