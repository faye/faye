Faye.Server = Faye.Class({
  initialize: function(options) {
    this.info('New server created');
    this._options     = options || {};
    this._channels    = new Faye.Channel.Tree();
    this._connections = {};
    this._namespace   = new Faye.Namespace();
  },
  
  clientIds: function() {
    return Faye.map(this._connections, function(key, value) { return key });
  },
  
  process: function(messages, localOrRemote, callback, scope) {
    var socket = (localOrRemote instanceof Faye.WebSocket) ? localOrRemote : null,
        local  = (localOrRemote === true);
    
    this.debug('Processing messages from ? client', local ? 'LOCAL' : 'REMOTE');
    
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
  
  flushConnection: function(messages) {
    messages = [].concat(messages);
    Faye.each(messages, function(message) {
      var connection = this._connections[message.clientId];
      if (connection) connection.flush();
    }, this);
  },
  
  _connection: function(id) {
    if (this._connections.hasOwnProperty(id)) return this._connections[id];
    var connection = new Faye.Connection(id, this._options);
    connection.addSubscriber('staleConnection', this._destroyConnection, this);
    return this._connections[id] = connection;
  },
  
  _destroyConnection: function(connection) {
    connection.disconnect();
    connection.removeSubscriber('staleConnection', this._destroyConnection, this);
    delete this._connections[connection.id];
  },
  
  _makeResponse: function(message) {
    var response = {};
    Faye.each(['id', 'clientId', 'channel', 'error'], function(field) {
      if (message[field]) response[field] = message[field];
    });
    response.successful = !response.error;
    return response;
  },
  
  _distributeMessage: function(message) {
    Faye.each(this._channels.glob(message.channel), function(channel) {
      channel.push(message);
      this.info('Publishing message ? from client ? to ?', message.data, message.clientId, channel.name);
    }, this);
  },
  
  _handle: function(message, socket, local, callback, scope) {
    if (!message) return callback.call(scope, []);
    if (message.error) return callback.call(scope, [this._makeResponse(message)]);
    
    this._distributeMessage(message);
    var channelName = message.channel, response;
    
    if (Faye.Channel.isMeta(channelName)) {
      this._handleMeta(message, socket, local, callback, scope);
    } else if (!message.clientId) {
      callback.call(scope, []);
    } else {
      response = this._makeResponse(message);
      response.successful = true;
      callback.call(scope, [response]);
    }
  },
  
  _handleMeta: function(message, socket, local, callback, scope) {
    var response = this[Faye.Channel.parse(message.channel)[1]](message, local);
    
    this._advize(response);
    
    if (response.channel === Faye.Channel.CONNECT && response.successful === true)
      return this._acceptConnection(message.advice, response, socket, callback, scope);
    
    callback.call(scope, [response]);
  },
  
  _acceptConnection: function(options, response, socket, callback, scope) {
    this.info('Accepting connection from ?', response.clientId);
    
    var connection = this._connection(response.clientId);
    
    // Disabled because CometD doesn't like messages not being
    // delivered as part of a /meta/* response
    // if (socket) return connection.setSocket(socket);
    
    connection.connect(options, function(events) {
      this.info('Sending event messages to ?', response.clientId);
      this.debug('Events for ?: ?', response.clientId, events);
      callback.call(scope, [response].concat(events));
    }, this);
  },
  
  _advize: function(response) {
    var connection = this._connections[response.clientId];
    
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
  handshake: function(message, local) {
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
    if (!response.successful) return response;
    
    var clientId = this._namespace.generate();
    response.clientId = this._connection(clientId).id;
    this.info('Accepting handshake from client ?', response.clientId);
    return response;
  },
  
  // MUST contain  * clientId
  //               * connectionType
  // MAY contain   * ext
  //               * id
  connect: function(message, local) {
    var response   = this._makeResponse(message);
    
    var clientId   = message.clientId,
        connection = clientId ? this._connections[clientId] : null,
        connectionType = message.connectionType;
    
    if (!connection)     response.error = Faye.Error.clientUnknown(clientId);
    if (!clientId)       response.error = Faye.Error.parameterMissing('clientId');
    if (!connectionType) response.error = Faye.Error.parameterMissing('connectionType');
    
    response.successful = !response.error;
    if (!response.successful) delete response.clientId;
    if (!response.successful) return response;
    
    response.clientId = connection.id;
    return response;
  },
  
  // MUST contain  * clientId
  // MAY contain   * ext
  //               * id
  disconnect: function(message, local) {
    var response   = this._makeResponse(message);
    
    var clientId   = message.clientId,
        connection = clientId ? this._connections[clientId] : null;
    
    if (!connection) response.error = Faye.Error.clientUnknown(clientId);
    if (!clientId)   response.error = Faye.Error.parameterMissing('clientId');
    
    response.successful = !response.error;
    if (!response.successful) delete response.clientId;
    if (!response.successful) return response;
    
    this._destroyConnection(connection);
    
    this.info('Disconnected client: ?', clientId);
    response.clientId = clientId;
    return response;
  },
  
  // MUST contain  * clientId
  //               * subscription
  // MAY contain   * ext
  //               * id
  subscribe: function(message, local) {
    var response     = this._makeResponse(message);
    
    var clientId     = message.clientId,
        connection   = clientId ? this._connections[clientId] : null,
        subscription = message.subscription;
    
    subscription = [].concat(subscription);
    
    if (!connection)           response.error = Faye.Error.clientUnknown(clientId);
    if (!clientId)             response.error = Faye.Error.parameterMissing('clientId');
    if (!message.subscription) response.error = Faye.Error.parameterMissing('subscription');
    
    response.subscription = subscription;
    
    Faye.each(subscription, function(channelName) {
      if (response.error) return;
      if (!local && !Faye.Channel.isSubscribable(channelName)) response.error = Faye.Error.channelForbidden(channelName);
      if (!Faye.Channel.isValid(channelName))                  response.error = Faye.Error.channelInvalid(channelName);
      
      if (response.error) return;
      var channel = this._channels.findOrCreate(channelName);
      
      this.info('Subscribing client ? to ?', clientId, channel.name);
      connection.subscribe(channel);
    }, this);
    
    response.successful = !response.error;
    return response;
  },
  
  // MUST contain  * clientId
  //               * subscription
  // MAY contain   * ext
  //               * id
  unsubscribe: function(message, local) {
    var response     = this._makeResponse(message);
    
    var clientId     = message.clientId,
        connection   = clientId ? this._connections[clientId] : null,
        subscription = message.subscription;
    
    subscription = [].concat(subscription);
    
    if (!connection)           response.error = Faye.Error.clientUnknown(clientId);
    if (!clientId)             response.error = Faye.Error.parameterMissing('clientId');
    if (!message.subscription) response.error = Faye.Error.parameterMissing('subscription');
    
    response.subscription = subscription;
    
    Faye.each(subscription, function(channelName) {
      if (response.error) return;
      
      if (!Faye.Channel.isValid(channelName))
        return response.error = Faye.Error.channelInvalid(channelName);
      
      var channel = this._channels.get(channelName);
      if (!channel) return;
      
      this.info('Unsubscribing client ? from ?', clientId, channel.name);
      connection.unsubscribe(channel);
      if (channel.isUnused()) this._channels.remove(channelName);
    }, this);
    
    response.successful = !response.error;
    return response;
  }
});

Faye.extend(Faye.Server.prototype, Faye.Logging);
Faye.extend(Faye.Server.prototype, Faye.Extensible);

