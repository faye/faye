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
  INTERVAL:             <%= Faye::Connection::INTERVAL %>,
  
  initialize: function(endpoint, options) {
    this.info('New client created for ?', endpoint);
    
    this._endpoint  = endpoint || this.DEFAULT_ENDPOINT;
    this._options   = options || {};
    
    this._transport = Faye.Transport.get(this, Faye.MANDATORY_CONNECTION_TYPES);
    this._state     = this.UNCONNECTED;
    this._outbox    = [];
    this._channels  = new Faye.Channel.Tree();
    
    this._advice = {
      reconnect: this.RETRY,
      interval:  1000 * (this._options.interval || this.INTERVAL),
      timeout:   1000 * (this._options.timeout  || this.CONNECTION_TIMEOUT)
    };
    
    if (Faye.Event) Faye.Event.on(Faye.ENV, 'beforeunload',
                                  this.disconnect, this);
  },
  
  getTimeout: function() {
    return this._advice.timeout / 1000;
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
    
    this.info('Initiating handshake with ?', this._endpoint);
    
    this._send({
      channel:      Faye.Channel.HANDSHAKE,
      version:      Faye.BAYEUX_VERSION,
      supportedConnectionTypes: Faye.Transport.supportedConnectionTypes()
      
    }, function(response) {
      
      if (response.successful) {
        this._state     = this.CONNECTED;
        this._clientId  = response.clientId;
        this._transport = Faye.Transport.get(this, response.supportedConnectionTypes);
        
        this.info('Handshake successful: ?', this._clientId);
        
        this.subscribe(this._channels.getKeys());
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
    if (this._state === this.CONNECTING || this._paused) return;
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
      
    }, this._verifyClientId(function(response) {
      this._cycleConnection();
    }));
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
    channels = [].concat(channels);
    if (channels.length === 0) return;
    this._validateChannels(channels);
    
    this.connect(function() {
      this.info('Client ? attempting to subscribe to ?', this._clientId, channels);
      
      this._send({
        channel:      Faye.Channel.SUBSCRIBE,
        clientId:     this._clientId,
        subscription: channels
        
      }, this._verifyClientId(function(response) {
        if (!response.successful) return;
        
        var channels = [].concat(response.subscription);
        this.info('Subscription acknowledged for ? to ?', this._clientId, channels);
        this._channels.subscribe(channels, callback, scope);
      }));
      
    }, this);
    
    return new Faye.Subscription(this, channels, callback, scope);
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
    channels = [].concat(channels);
    if (channels.length === 0) return;
    this._validateChannels(channels);
    
    var deadChannels = this._channels.unsubscribe(channels, callback, scope);
    
    this.connect(function() {
      this.info('Client ? attempting to unsubscribe from ?', this._clientId, deadChannels);
      
      this._send({
        channel:      Faye.Channel.UNSUBSCRIBE,
        clientId:     this._clientId,
        subscription: deadChannels
        
      }, this._verifyClientId(function(response) {
        if (!response.successful) return;
        
        var channels = [].concat(response.subscription);
        this.info('Unsubscription acknowledged for ? from ?', this._clientId, channels);
      }));
      
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
      
      this.info('Client ? queueing published message to ?: ?', this._clientId, channel, data);
      
      this._enqueue({
        channel:      channel,
        data:         data,
        clientId:     this._clientId
        
      }, function() {
        this.addTimeout('publish', this.MAX_DELAY, this._flush, this);
      });
    }, this);
  },
  
  handleAdvice: function(advice) {
    Faye.extend(this._advice, advice);
    
    if (this._advice.reconnect === this.HANDSHAKE && this._state !== this.DISCONNECTED) {
      this._state    = this.UNCONNECTED;
      this._clientId = null;
      this._cycleConnection();
    }
  },
  
  deliverMessages: function(messages) {
    Faye.each(messages, function(message) {
      this.info('Client ? calling listeners for ? with ?', this._clientId, message.channel, message.data);
      this._channels.distributeMessage(message);
    }, this);
  },
  
  pause: function() {
    if (this._paused) return;
    this._paused = true;
    if (this._connectRequest) this._transport.abort(this._connectRequest);
    this._teardownConnection();
  },
  
  resume: function() {
    if (!this._paused) return;
    this._paused = false;
    this._cycleConnection();
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
  
  _send: function(message, callback, scope) {
    this.pipeThroughExtensions('outgoing', message, function(message) {
      if (!message) return;
      
      var request = this._transport.send(message, callback, scope);
      if (message.channel === Faye.Channel.CONNECT)
        this._connectRequest = request;
      
    }, this);
  },
  
  _enqueue: function(message, callback) {
    this.pipeThroughExtensions('outgoing', message, function(message) {
      if (!message) return;
      this._outbox.push(message);
      callback.call(this);
    }, this);
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
  
  _verifyClientId: function(callback) {
    var self = this;
    return function(response) {
      if (response.clientId !== self._clientId) return false;
      callback.call(self, response);
      return true;
    };
  }
});

Faye.extend(Faye.Client.prototype, Faye.Deferrable);
Faye.extend(Faye.Client.prototype, Faye.Timeouts);
Faye.extend(Faye.Client.prototype, Faye.Logging);
Faye.extend(Faye.Client.prototype, Faye.Extensible);

