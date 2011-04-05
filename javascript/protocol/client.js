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
  INTERVAL:             <%= Faye::Engine::INTERVAL %>,
  
  initialize: function(endpoint, options) {
    this.info('New client created for ?', endpoint);
    
    this.endpoint   = endpoint || this.DEFAULT_ENDPOINT;
    this._options   = options || {};
    
    Faye.Transport.get(this, Faye.MANDATORY_CONNECTION_TYPES, function(transport) {
      this._transport = transport;
    }, this);
    
    this._state     = this.UNCONNECTED;
    this._channels  = new Faye.Channel.Set();
    
    this._namespace = new Faye.Namespace();
    this._responseCallbacks = {};
    
    this._advice = {
      reconnect: this.RETRY,
      interval:  1000 * (this._options.interval || this.INTERVAL),
      timeout:   1000 * (this._options.timeout  || this.CONNECTION_TIMEOUT)
    };
    
    if (Faye.Event) Faye.Event.on(Faye.ENV, 'beforeunload',
                                  this.disconnect, this);
  },
  
  getClientId: function() {
    return this._clientId;
  },

  getState: function() {
    switch (this._state) {
      case this.UNCONNECTED:  return 'UNCONNECTED';
      case this.CONNECTING:   return 'CONNECTING';
      case this.CONNECTED:    return 'CONNECTED';
      case this.DISCONNECTED: return 'DISCONNECTED';
    }
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
    
    this.info('Initiating handshake with ?', this.endpoint);
    
    this._send({
      channel:      Faye.Channel.HANDSHAKE,
      version:      Faye.BAYEUX_VERSION,
      supportedConnectionTypes: [this._transport.connectionType]
      
    }, function(response) {
      
      if (response.successful) {
        this._state     = this.CONNECTED;
        this._clientId  = response.clientId;
        
        Faye.Transport.get(this, response.supportedConnectionTypes, function(transport) {
          this._transport = transport;
        }, this);
        
        this.info('Handshake successful: ?', this._clientId);
        
        this.subscribe(this._channels.getKeys(), true);
        if (callback) callback.call(scope);
        
      } else {
        this.info('Handshake unsuccessful');
        setTimeout(function() { self.handshake(callback, scope) }, this._advice.interval);
        this._state = this.UNCONNECTED;
      }
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
    
    if (this._state === this.UNCONNECTED)
      return this.handshake(function() { this.connect(callback, scope) }, this);
    
    this.callback(callback, scope);
    if (this._state !== this.CONNECTED) return;
    
    this.info('Calling deferred actions for ?', this._clientId);
    this.setDeferredStatus('succeeded');
    this.setDeferredStatus('deferred');
    
    if (this._connectRequest) return;
    this._connectRequest = true;
    
    this.info('Initiating connection for ?', this._clientId);
    
    this._send({
      channel:        Faye.Channel.CONNECT,
      clientId:       this._clientId,
      connectionType: this._transport.connectionType
      
    }, this._cycleConnection, this);
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
    
    this.info('Disconnecting ?', this._clientId);
    
    this._send({
      channel:    Faye.Channel.DISCONNECT,
      clientId:   this._clientId
    });
    
    this.info('Clearing channel listeners for ?', this._clientId);
    this._channels = new Faye.Channel.Set();
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
    if (channels instanceof Array)
      return  Faye.each(channels, function(channel) {
                this.subscribe(channel, callback, scope);
              }, this);
    
    this._validateChannel(channels);
    var subscription = new Faye.Subscription(this, channels, callback, scope);
    
    var force = (callback === true);
    
    if (!force && this._channels.hasSubscription(channels)) {
      this._channels.subscribe([channels], callback, scope);
      subscription.setDeferredStatus('succeeded');
      return subscription;
    }
    
    this.connect(function() {
      this.info('Client ? attempting to subscribe to ?', this._clientId, channels);
      
      this._send({
        channel:      Faye.Channel.SUBSCRIBE,
        clientId:     this._clientId,
        subscription: channels
        
      }, function(response) {
        if (!response.successful) return;
        
        var channels = [].concat(response.subscription);
        this.info('Subscription acknowledged for ? to ?', this._clientId, channels);
        this._channels.subscribe(channels, callback, scope);
        
        subscription.setDeferredStatus('succeeded');
      }, this);
      
    }, this);
    
    return subscription;
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
    if (channels instanceof Array)
      return  Faye.each(channels, function(channel) {
                this.unsubscribe(channel, callback, scope);
              }, this);
    
    this._validateChannel(channels);
    
    var dead = this._channels.unsubscribe(channels, callback, scope);
    if (!dead) return;
    
    this.connect(function() {
      this.info('Client ? attempting to unsubscribe from ?', this._clientId, channels);
      
      this._send({
        channel:      Faye.Channel.UNSUBSCRIBE,
        clientId:     this._clientId,
        subscription: channels
        
      }, function(response) {
        if (!response.successful) return;
        
        var channels = [].concat(response.subscription);
        this.info('Unsubscription acknowledged for ? from ?', this._clientId, channels);
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
    this._validateChannel(channel);
    
    this.connect(function() {
      this.info('Client ? queueing published message to ?: ?', this._clientId, channel, data);
      
      this._send({
        channel:      channel,
        data:         data,
        clientId:     this._clientId
      });
    }, this);
  },
  
  receiveMessage: function(message) {
    this.pipeThroughExtensions('incoming', message, function(message) {
      if (!message) return;
      
      if (message.advice) this._handleAdvice(message.advice);
      
      var callback = this._responseCallbacks[message.id];
      if (callback) {
        delete this._responseCallbacks[message.id];
        callback[0].call(callback[1], message);
      }
      
      this._deliverMessage(message);
    }, this);
  },
  
  _send: function(message, callback, scope) {
    message.id = this._namespace.generate();
    if (callback) this._responseCallbacks[message.id] = [callback, scope];

    this.pipeThroughExtensions('outgoing', message, function(message) {
      if (!message) return;
      this._transport.send(message, this._advice.timeout / 1000);
    }, this);
  },

  _handleAdvice: function(advice) {
    Faye.extend(this._advice, advice);
    
    if (this._advice.reconnect === this.HANDSHAKE && this._state !== this.DISCONNECTED) {
      this._state    = this.UNCONNECTED;
      this._clientId = null;
      this._cycleConnection();
    }
  },
  
  _deliverMessage: function(message) {
    if (!message.channel || !message.data) return;
    this.info('Client ? calling listeners for ? with ?', this._clientId, message.channel, message.data);
    this._channels.distributeMessage(message);
  },
  
  _teardownConnection: function() {
    if (!this._connectRequest) return;
    this._connectRequest = null;
    this.info('Closed connection for ?', this._clientId);
  },
  
  _cycleConnection: function() {
    this._teardownConnection();
    var self = this;
    setTimeout(function() { self.connect() }, this._advice.interval);
  },
  
  _validateChannel: function(channel) {
    if (!Faye.Channel.isValid(channel))
      throw '"' + channel + '" is not a valid channel name';
    if (!Faye.Channel.isSubscribable(channel))
      throw 'Clients may not subscribe to channel "' + channel + '"';
  }
});

Faye.extend(Faye.Client.prototype, Faye.Deferrable);
Faye.extend(Faye.Client.prototype, Faye.Logging);
Faye.extend(Faye.Client.prototype, Faye.Extensible);

