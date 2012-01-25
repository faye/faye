Faye.Server = Faye.Class({
  initialize: function(options) {
    this._options  = options || {};
    var engineOpts = this._options.engine || {};
    engineOpts.timeout = this._options.timeout;
    this._engine   = Faye.Engine.get(engineOpts);

    this.info('Created new server: ?', this._options);
  },
  
  flushConnection: function(messages) {
    var clientId = [].concat(messages)[0].clientId;
    if (!clientId) return;
    this.info('Flushing connection for ?', clientId);
    this._engine.flush(clientId);
  },
  
  openSocket: function(clientId, socket) {
    this._engine.openSocket(clientId, socket);
  },
  
  closeSocket: function(clientId) {
    this._engine.flush(clientId);
  },
  
  process: function(messages, local, callback, context) {
    messages = [].concat(messages);
    this.info('Processing messages: ? (local: ?)', messages, local);

    if (messages.length === 0) return callback.call(context, []);
    var processed = 0, responses = [], self = this;
    
    var gatherReplies = function(replies) {
      responses = responses.concat(replies);
      processed += 1;
      if (processed < messages.length) return;
      
      var n = responses.length;
      while (n--) {
        if (!responses[n]) responses.splice(n,1);
      }
      self.info('Returning replies: ?', responses);
      callback.call(context, responses);
    };
    
    var handleReply = function(replies) {
      var extended = 0, expected = replies.length;
      if (expected === 0) gatherReplies(replies);
      
      for (var i = 0, n = replies.length; i < n; i++) {
        this.debug('Processing reply: ?', replies[i]);
        this.pipeThroughExtensions('outgoing', replies[i], function(message) {
          replies[i] = message;
          extended  += 1;
          if (extended === expected) gatherReplies(replies);
        });
      }
    };
    
    for (var i = 0, n = messages.length; i < n; i++) {
      this.pipeThroughExtensions('incoming', messages[i], function(pipedMessage) {
        this._handle(pipedMessage, local, handleReply, this);
      }, this);
    }
  },
  
  _makeResponse: function(message) {
    var response = {};
    
    if (message.id)       response.id       = message.id;
    if (message.clientId) response.clientId = message.clientId;
    if (message.channel)  response.channel  = message.channel;
    if (message.error)    response.error    = message.error;
    
    response.successful = !response.error;
    return response;
  },
  
  _handle: function(message, local, callback, context) {
    if (!message) return callback.call(context, []);
    this.info('Handling message: ? (local: ?)', message, local);
    
    var channelName = message.channel,
        error       = message.error,
        response;
    
    if (Faye.Channel.isMeta(channelName))
      return this._handleMeta(message, local, callback, context);
    
    if (!Faye.Grammar.CHANNEL_NAME.test(channelName))
      error = Faye.Error.channelInvalid(channelName);
    
    if (!error) this._engine.publish(message);
    
    response = this._makeResponse(message);
    if (error) response.error = error;
    response.successful = !response.error;
    callback.call(context, [response]);
  },
  
  _handleMeta: function(message, local, callback, context) {
    var method   = Faye.Channel.parse(message.channel)[1],
        clientId = message.clientId;
    
    this[method](message, local, function(responses) {
      responses = [].concat(responses);
      for (var i = 0, n = responses.length; i < n; i++) this._advize(responses[i], message.connectionType);
      callback.call(context, responses);
    }, this);
  },
  
  _advize: function(response, connectionType) {
    if (Faye.indexOf([Faye.Channel.HANDSHAKE, Faye.Channel.CONNECT], response.channel) < 0)
      return;
    
    var interval, timeout;
    if (connectionType === 'eventsource') {
      interval = Math.floor(this._engine.timeout * 1000);
      timeout  = 0;
    } else {
      interval = Math.floor(this._engine.interval * 1000);
      timeout  = Math.floor(this._engine.timeout * 1000);
    }
    
    response.advice = response.advice || {};
    if (response.error) {
      Faye.extend(response.advice, {reconnect:  'handshake'}, false);
    } else {
      Faye.extend(response.advice, {
        reconnect:  'retry',
        interval:   interval,
        timeout:    timeout
      }, false);
    }
  },
  
  // MUST contain  * version
  //               * supportedConnectionTypes
  // MAY contain   * minimumVersion
  //               * ext
  //               * id
  handshake: function(message, local, callback, context) {
    var response = this._makeResponse(message);
    response.version = Faye.BAYEUX_VERSION;
    
    if (!message.version)
      response.error = Faye.Error.parameterMissing('version');
    
    var clientConns = message.supportedConnectionTypes,
        commonConns;
    
    response.supportedConnectionTypes = Faye.CONNECTION_TYPES;
    
    if (clientConns) {
      commonConns = Faye.filter(clientConns, function(conn) {
        return Faye.indexOf(Faye.CONNECTION_TYPES, conn) >= 0;
      });
      if (commonConns.length === 0)
        response.error = Faye.Error.conntypeMismatch(clientConns);
    } else {
      response.error = Faye.Error.parameterMissing('supportedConnectionTypes');
    }
    
    response.successful = !response.error;
    if (!response.successful) return callback.call(context, response);
    
    this._engine.createClient(function(clientId) {
      response.clientId = clientId;
      callback.call(context, response);
    }, this);
  },
  
  // MUST contain  * clientId
  //               * connectionType
  // MAY contain   * ext
  //               * id
  connect: function(message, local, callback, context) {
    var response       = this._makeResponse(message),
        clientId       = message.clientId,
        connectionType = message.connectionType;
    
    this._engine.clientExists(clientId, function(exists) {
      if (!exists)         response.error = Faye.Error.clientUnknown(clientId);
      if (!clientId)       response.error = Faye.Error.parameterMissing('clientId');
      
      if (Faye.indexOf(Faye.CONNECTION_TYPES, connectionType) < 0)
        response.error = Faye.Error.conntypeMismatch(connectionType);
      
      if (!connectionType) response.error = Faye.Error.parameterMissing('connectionType');
      
      response.successful = !response.error;
      
      if (!response.successful) {
        delete response.clientId;
        return callback.call(context, response);
      }
      
      if (message.connectionType === 'eventsource') {
        message.advice = message.advice || {};
        message.advice.timeout = 0;
      }
      this._engine.connect(response.clientId, message.advice, function(events) {
        callback.call(context, [response].concat(events));
      });
    }, this);
  },
  
  // MUST contain  * clientId
  // MAY contain   * ext
  //               * id
  disconnect: function(message, local, callback, context) {
    var response = this._makeResponse(message),
        clientId = message.clientId;
    
    this._engine.clientExists(clientId, function(exists) {
      if (!exists)   response.error = Faye.Error.clientUnknown(clientId);
      if (!clientId) response.error = Faye.Error.parameterMissing('clientId');
      
      response.successful = !response.error;
      if (!response.successful) delete response.clientId;
      
      if (response.successful) this._engine.destroyClient(clientId);
      callback.call(context, response);
    }, this);
  },
  
  // MUST contain  * clientId
  //               * subscription
  // MAY contain   * ext
  //               * id
  subscribe: function(message, local, callback, context) {
    var response     = this._makeResponse(message),
        clientId     = message.clientId,
        subscription = message.subscription,
        channel;
    
    subscription = subscription ? [].concat(subscription) : [];
    
    this._engine.clientExists(clientId, function(exists) {
      if (!exists)               response.error = Faye.Error.clientUnknown(clientId);
      if (!clientId)             response.error = Faye.Error.parameterMissing('clientId');
      if (!message.subscription) response.error = Faye.Error.parameterMissing('subscription');
      
      response.subscription = message.subscription || [];
      
      for (var i = 0, n = subscription.length; i < n; i++) {
        channel = subscription[i];
        
        if (response.error) return;
        if (!local && !Faye.Channel.isSubscribable(channel)) response.error = Faye.Error.channelForbidden(channel);
        if (!Faye.Channel.isValid(channel))                  response.error = Faye.Error.channelInvalid(channel);
        
        if (response.error) return;
        this._engine.subscribe(clientId, channel);
      }
      
      response.successful = !response.error;
      callback.call(context, response);
    }, this);
  },
  
  // MUST contain  * clientId
  //               * subscription
  // MAY contain   * ext
  //               * id
  unsubscribe: function(message, local, callback, context) {
    var response     = this._makeResponse(message),
        clientId     = message.clientId,
        subscription = message.subscription,
        channel;
    
    subscription = subscription ? [].concat(subscription) : [];
    
    this._engine.clientExists(clientId, function(exists) {
      if (!exists)               response.error = Faye.Error.clientUnknown(clientId);
      if (!clientId)             response.error = Faye.Error.parameterMissing('clientId');
      if (!message.subscription) response.error = Faye.Error.parameterMissing('subscription');
      
      response.subscription = message.subscription || [];
      
      for (var i = 0, n = subscription.length; i < n; i++) {
        channel = subscription[i];
        
        if (response.error) return;
        if (!local && !Faye.Channel.isSubscribable(channel)) response.error = Faye.Error.channelForbidden(channel);
        if (!Faye.Channel.isValid(channel))                  response.error = Faye.Error.channelInvalid(channel);
        
        if (response.error) return;
        this._engine.unsubscribe(clientId, channel);
      }
      
      response.successful = !response.error;
      callback.call(context, response);
    }, this);
  }
});

Faye.extend(Faye.Server.prototype, Faye.Logging);
Faye.extend(Faye.Server.prototype, Faye.Extensible);

