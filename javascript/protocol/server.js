Faye.Server = Faye.Class({
  initialize: function(options) {
    this._options     = options || {};
    this._connections = {};
    this._engine      = Faye.Engine.get('memory', options);
    
    this._engine.addSubscriber('message', function(clientId, message) {
      var connection = this._connection(clientId);
      connection.deliver(message);
    }, this);
    
    this._engine.addSubscriber('disconnect', function(clientId) {
      var connection = this._connections[clientId];
      this._destroyConnection(connection);
    }, this);
  },
  
  _connection: function(id) {
    if (this._connections.hasOwnProperty(id)) return this._connections[id];
    var connection = new Faye.Connection(id, this._options);
    connection.addSubscriber('staleConnection', this._destroyConnection, this);
    return this._connections[id] = connection;
  },
  
  _destroyConnection: function(connection) {
    if (!connection) return;
    connection.flush();
    connection.removeSubscribers();
    delete this._connections[connection.id];
  },
  
  _acceptConnection: function(options, response, socket, callback, scope) {
    var connection = this._connection(response.clientId);
    connection.connect(options, function(events) {
      callback.call(scope, [response].concat(events));
    }, this);
  },
  
  flushConnection: function(messages) {
    messages = [].concat(messages);
    Faye.each(messages, function(message) {
      var connection = this._connections[message.clientId];
      if (connection) connection.flush();
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
  
  process: function(messages, localOrRemote, callback, scope) {
    var socket = (localOrRemote instanceof Faye.WebSocket) ? localOrRemote : null,
        local  = (localOrRemote === true);
    
    messages = [].concat(messages);
    var processed = 0, responses = [];
    
    var gatherReplies = function(replies) {
      responses = responses.concat(replies);
      processed += 1;
      if (processed < messages.length) return;
      
      var n = responses.length;
      while (n--) {
        if (!responses[n]) responses.splice(n,1);
      }
      callback.call(scope, responses);
    };
    
    var handleReply = function(replies) {
      var extended = 0, expected = replies.length;
      if (expected === 0) gatherReplies(replies);
      
      Faye.each(replies, function(reply, i) {
        this.pipeThroughExtensions('outgoing', reply, function(message) {
          replies[i] = message;
          extended  += 1;
          if (extended === expected) gatherReplies(replies);
        });
      }, this);
    };
    
    Faye.each(messages, function(message) {
      this.pipeThroughExtensions('incoming', message, function(pipedMessage) {
        this._handle(pipedMessage, socket, local, handleReply, this);
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
  
  _handle: function(message, socket, local, callback, scope) {
    if (!message) return callback.call(scope, []);
    
    this._engine.publish(message);
    var channelName = message.channel, response;
    
    if (Faye.Channel.isMeta(channelName)) {
      this._handleMeta(message, socket, local, callback, scope);
    } else if (!message.clientId) {
      callback.call(scope, []);
    } else {
      response = this._makeResponse(message);
      response.successful = !response.error;
      callback.call(scope, [response]);
    }
  },
  
  _handleMeta: function(message, socket, local, callback, scope) {
    var method = Faye.Channel.parse(message.channel)[1];
    
    this[method](message, local, function(response) {
      this._advize(response);
      
      if (response.channel === Faye.Channel.CONNECT && response.successful === true)
        return this._acceptConnection(message.advice, response, socket, callback, scope);
      
      callback.call(scope, [response]);
    }, this);
  },
  
  _advize: function(response) {
    var connection = response.clientId && this._connection(response.clientId);
    
    response.advice = response.advice || {};
    if (connection) {
      Faye.extend(response.advice, {
        reconnect:  'retry',
        interval:   Math.floor(connection.interval * 1000),
        timeout:    Math.floor(connection.timeout * 1000)
      }, false);
    } else {
      Faye.extend(response.advice, {
        reconnect:  'handshake'
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
          return Faye.indexOf(Faye.CONNECTION_TYPES, conn) !== -1;
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
      if (!connectionType) response.error = Faye.Error.parameterMissing('connectionType');
      
      response.successful = !response.error;
      if (!response.successful) delete response.clientId;
      
      if (response.successful) this._engine.ping(clientId);
      callback.call(scope, response);
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
      
      response.subscription = subscription;
      
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
      
      response.subscription = subscription;
      
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

