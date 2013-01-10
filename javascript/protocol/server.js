Faye.Server = Faye.Class({
  META_METHODS: <%= Faye::Server::META_METHODS.inspect %>,

  initialize: function(options) {
    this._options  = options || {};
    var engineOpts = this._options.engine || {};
    engineOpts.timeout = this._options.timeout;
    this._engine   = Faye.Engine.get(engineOpts);

    this.info('Created new server: ?', this._options);
  },
  
  flushConnection: function(messages) {
    Faye.each([].concat(messages), function(message) {
      var clientId = message.clientId;
      this.info('Flushing connection for ?', clientId);
      if (clientId) this._engine.flush(clientId);
    }, this);
  },
  
  determineClient: function(messages) {
    messages = [].concat(messages);
    var i = messages.length, message;
    while (i--) {
      message = messages[i];
      if (message.channel === Faye.Channel.CONNECT)
        return message.clientId;
    }
    return null;
  },
  
  process: function(messages, local, callback, scope) {
    messages = [].concat(messages);
    this.info('Processing messages: ? (local: ?)', messages, local);

    if (messages.length === 0) return callback.call(scope, []);
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
      callback.call(scope, responses);
    };
    
    var handleReply = function(replies) {
      var extended = 0, expected = replies.length;
      if (expected === 0) gatherReplies(replies);
      
      Faye.each(replies, function(reply, i) {
        this.debug('Processing reply: ?', reply);
        this.pipeThroughExtensions('outgoing', reply, function(message) {
          replies[i] = message;
          extended  += 1;
          if (extended === expected) gatherReplies(replies);
        });
      }, this);
    };
    
    Faye.each(messages, function(message) {
      this.pipeThroughExtensions('incoming', message, function(pipedMessage) {
        this._handle(pipedMessage, local, handleReply, this);
      }, this);
    }, this);
  },
  
  _makeResponse: function(message) {
    var response = {};
    Faye.each(['id', 'clientId', 'channel', 'error'], function(field) {
      if (message[field]) response[field] = message[field];
    });
    response.successful = !response.error;
    return response;
  },
  
  _handle: function(message, local, callback, scope) {
    if (!message) return callback.call(scope, []);
    this.info('Handling message: ? (local: ?)', message, local);
    
    var channelName = message.channel, response;
    
    if (Faye.Channel.isMeta(channelName))
      return this._handleMeta(message, local, callback, scope);
    
    if (!message.error && Faye.Grammar.CHANNEL_NAME.test(channelName))
      this._engine.publish(message);
    
    if (message.clientId) {
      response = this._makeResponse(message);
      response.successful = !response.error;
      callback.call(scope, [response]);
    } else {
      callback.call(scope, []);
    }
  },
  
  _handleMeta: function(message, local, callback, scope) {
    var method = Faye.Channel.parse(message.channel)[1],
        response;
    
    if (Faye.indexOf(this.META_METHODS, method) < 0) {
      response = this._makeResponse(message);
      response.error = Faye.Error.channelForbidden(message.channel);
      response.successful = false;
      return callback.call(scope, [response]);
    }

    this[method](message, local, function(responses) {
      responses = [].concat(responses);
      Faye.each(responses, this._advize, this);
      callback.call(scope, responses);
    }, this);
  },
  
  _advize: function(response) {
    if (Faye.indexOf([Faye.Channel.HANDSHAKE, Faye.Channel.CONNECT], response.channel) < 0)
      return;
    
    response.advice = response.advice || {};
    if (response.error) {
      Faye.extend(response.advice, {reconnect:  'handshake'}, false);
    } else {
      Faye.extend(response.advice, {
        reconnect:  'retry',
        interval:   Math.floor(this._engine.interval * 1000),
        timeout:    Math.floor(this._engine.timeout * 1000)
      }, false);
    }
  },
  
  // MUST contain  * version
  //               * supportedConnectionTypes
  // MAY contain   * minimumVersion
  //               * ext
  //               * id
  handshake: function(message, local, callback, scope) {
    var response = this._makeResponse(message);
    response.version = Faye.BAYEUX_VERSION;
    
    if (!message.version)
      response.error = Faye.Error.parameterMissing('version');
    
    var clientConns = message.supportedConnectionTypes,
        commonConns;
    
    if (!local) {
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
    }
    
    response.successful = !response.error;
    if (!response.successful) return callback.call(scope, response);
    
    this._engine.createClient(function(clientId) {
      response.clientId = clientId;
      callback.call(scope, response);
    }, this);
  },
  
  // MUST contain  * clientId
  //               * connectionType
  // MAY contain   * ext
  //               * id
  connect: function(message, local, callback, scope) {
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
        return callback.call(scope, response);
      }
      
      this._engine.connect(response.clientId, message.advice, function(events) {
        callback.call(scope, [response].concat(events));
      });
    }, this);
  },
  
  // MUST contain  * clientId
  // MAY contain   * ext
  //               * id
  disconnect: function(message, local, callback, scope) {
    var response = this._makeResponse(message),
        clientId = message.clientId;
    
    this._engine.clientExists(clientId, function(exists) {
      if (!exists)   response.error = Faye.Error.clientUnknown(clientId);
      if (!clientId) response.error = Faye.Error.parameterMissing('clientId');
      
      response.successful = !response.error;
      if (!response.successful) delete response.clientId;
      
      if (response.successful) this._engine.destroyClient(clientId);
      callback.call(scope, response);
    }, this);
  },
  
  // MUST contain  * clientId
  //               * subscription
  // MAY contain   * ext
  //               * id
  subscribe: function(message, local, callback, scope) {
    var response     = this._makeResponse(message),
        clientId     = message.clientId,
        subscription = message.subscription;
    
    subscription = subscription ? [].concat(subscription) : [];
    
    this._engine.clientExists(clientId, function(exists) {
      if (!exists)               response.error = Faye.Error.clientUnknown(clientId);
      if (!clientId)             response.error = Faye.Error.parameterMissing('clientId');
      if (!message.subscription) response.error = Faye.Error.parameterMissing('subscription');
      
      response.subscription = message.subscription || [];
      
      Faye.each(subscription, function(channel) {
        if (response.error) return;
        if (!local && !Faye.Channel.isSubscribable(channel)) response.error = Faye.Error.channelForbidden(channel);
        if (!Faye.Channel.isValid(channel))                  response.error = Faye.Error.channelInvalid(channel);
        
        if (response.error) return;
        this._engine.subscribe(clientId, channel);
      }, this);
      
      response.successful = !response.error;
      callback.call(scope, response);
    }, this);
  },
  
  // MUST contain  * clientId
  //               * subscription
  // MAY contain   * ext
  //               * id
  unsubscribe: function(message, local, callback, scope) {
    var response     = this._makeResponse(message),
        clientId     = message.clientId,
        subscription = message.subscription;
    
    subscription = subscription ? [].concat(subscription) : [];
    
    this._engine.clientExists(clientId, function(exists) {
      if (!exists)               response.error = Faye.Error.clientUnknown(clientId);
      if (!clientId)             response.error = Faye.Error.parameterMissing('clientId');
      if (!message.subscription) response.error = Faye.Error.parameterMissing('subscription');
      
      response.subscription = message.subscription || [];
      
      Faye.each(subscription, function(channel) {
        if (response.error) return;
        if (!local && !Faye.Channel.isSubscribable(channel)) response.error = Faye.Error.channelForbidden(channel);
        if (!Faye.Channel.isValid(channel))                  response.error = Faye.Error.channelInvalid(channel);
        
        if (response.error) return;
        this._engine.unsubscribe(clientId, channel);
      }, this);
      
      response.successful = !response.error;
      callback.call(scope, response);
    }, this);
  }
});

Faye.extend(Faye.Server.prototype, Faye.Logging);
Faye.extend(Faye.Server.prototype, Faye.Extensible);

