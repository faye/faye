Faye.Client = Faye.Class({
  UNCONNECTED:          <%= Faye::Client::UNCONNECTED %>,
  CONNECTING:           <%= Faye::Client::CONNECTING %>,
  CONNECTED:            <%= Faye::Client::CONNECTED %>,
  DISCONNECTED:         <%= Faye::Client::DISCONNECTED %>,
  
  HANDSHAKE:            '<%= Faye::Client::HANDSHAKE %>',
  RETRY:                '<%= Faye::Client::RETRY %>',
  NONE:                 '<%= Faye::Client::NONE %>',
  
  CONNECTION_TIMEOUT:   <%= Faye::Client::CONNECTION_TIMEOUT %>,
  
  DEFAULT_ENDPOINT:     '<%= Faye::RackAdapter::DEFAULT_ENDPOINT %>',
  MAX_DELAY:            <%= Faye::Connection::MAX_DELAY %>,
  INTERVAL:             <%= Faye::Connection::INTERVAL * 1000 %>,
  
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
    if (this._state === this.DISCONNECTED) return;
    
    if (this._advice.reconnect === this.HANDSHAKE || this._state === this.UNCONNECTED)
      return this.handshake(function() { this.connect(callback, scope) }, this);
    
    if (this._state === this.CONNECTING)
      return this.callback(callback, scope);
    
    if (this._state !== this.CONNECTED) return;
    
    this.setDeferredStatus('succeeded');
    this.setDeferredStatus('deferred');
    if (callback) callback.call(scope);
    
    if (this._connectionId) return;
    this._connectionId = this._namespace.generate();
    var self = this, hasResponse = false;
    
    this._transport.send({
      channel:        Faye.Channel.CONNECT,
      clientId:       this._clientId,
      connectionType: this._transport.connectionType,
      id:             this._connectionId
      
    }, function(response) {
      if (hasResponse) return;
      hasResponse = true;
      delete this._connectionId;
      setTimeout(function() { self.connect() }, this._advice.interval);
    }, this);
    
    setTimeout(function() {
      if (hasResponse) return;
      hasResponse = true;
      delete self._connectionId;
      delete self._clientId;
      self._state = self.UNCONNECTED;
      self.subscribe(self._channels.getKeys());
      
    }, 1000 * this.CONNECTION_TIMEOUT);
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
      channel:    Faye.Channel.DISCONNECT,
      clientId:   this._clientId
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
    this.connect(function() {
      
      channels = [].concat(channels);
      this._validateChannels(channels);
      
      this._transport.send({
        channel:      Faye.Channel.SUBSCRIBE,
        clientId:     this._clientId,
        subscription: channels
        
      }, function(response) {
        if (!response.successful || !callback) return;
        
        channels = [].concat(response.subscription);
        Faye.each(channels, function(channel) {
          this._channels.set(channel, [callback, scope]);
        }, this);
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
    this.connect(function() {
      
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
      
    }, this);
  },
  
  // Request                              Response
  // MUST include:  * channel             MUST include:  * channel
  //                * data                               * successful
  // MAY include:   * clientId            MAY include:   * id
  //                * id                                 * error
  //                * ext                                * ext
  publish: function(channel, data) {
    this.connect(function() {
      
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
      
    }, this);
  },
  
  handleAdvice: function(advice) {
    Faye.extend(this._advice, advice);
    if (this._advice.reconnect === this.HANDSHAKE) this._clientId = null;
  },
  
  sendToSubscribers: function(message) {
    var channels = this._channels.glob(message.channel);
    Faye.each(channels, function(callback) {
      if (!callback) return;
      callback[0].call(callback[1], message.data);
    });
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
  }
});

Faye.extend(Faye.Client.prototype, Faye.Deferrable);

