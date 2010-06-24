Faye.Server = Faye.Class({
  initialize: function(options) {
    this.info('New server created');
    this._options     = options || {};
    this._channels    = new Faye.Channel.Tree();
    this._connections = {};
    this._namespace   = new Faye.Namespace();
  },
  
  clientIds: function() {
    var ids = [];
    Faye.each(this._connections, function(key, value) { ids.push(key) });
    return ids;
  },
  
  process: function(messages, local, callback, scope) {
    this.debug('Processing messages from ? client', local ? 'LOCAL' : 'REMOTE');
    
    messages = [].concat(messages);
    var processed = 0, responses = [];
    
    var handleReply = function(replies) {
      var extended = 0, expected = replies.length;
      
      Faye.each(replies, function(reply, i) {
        this.pipeThroughExtensions('outgoing', reply, function(message) {
          replies[i] = message;
          
          extended += 1;
          if (extended < expected) return;
          
          responses = responses.concat(replies);
          processed += 1;
          if (processed < messages.length) return;
          
          var n = responses.length;
          while (n--) {
            if (!responses[n]) responses.splice(n,1);
          }
          callback.call(scope, responses);
          
        }, this);
      }, this);
    };
    
    Faye.each(messages, function(message) {
      this._handle(message, local, handleReply, this);
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
  
  _handle: function(message, local, callback, scope) {
    this.pipeThroughExtensions('incoming', message, function(message) {
      if (!message) return callback.call(scope, []);
      
      var channelName = message.channel, response;
      
      message.__id = Faye.random();
      Faye.each(this._channels.glob(channelName), function(channel) {
        channel.push(message);
        this.info('Publishing message ? from client ? to ?', message.data, message.clientId, channel.name);
      }, this);
      
      if (Faye.Channel.isMeta(channelName)) {
        response = this[Faye.Channel.parse(channelName)[1]](message, local);
        
        var clientId   = response.clientId,
            connection = this._connections[clientId];
        
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
        
        if (response.channel !== Faye.Channel.CONNECT ||
            response.successful !== true)
          return callback.call(scope, [response]);
        
        this.info('Accepting connection from ?', response.clientId);
        
        return this._connection(response.clientId).connect(function(events) {
          this.info('Sending event messages to ?', response.clientId);
          this.debug('Events for ?: ?', response.clientId, events);
          Faye.each(events, function(e) { delete e.__id });
          callback.call(scope, [response].concat(events));
        }, this);
      }
      
      if (!message.clientId || Faye.Channel.isService(channelName))
        return callback.call(scope, []);
      
      response = this._makeResponse(message);
      response.successful = true;
      callback.call(scope, [response]);
    }, this);
  },
  
  _makeResponse: function(message) {
    var response = {};
    Faye.each(['id', 'clientId', 'channel'], function(field) {
      if (message[field]) response[field] = message[field];
    });
    return response;
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
    
    Faye.each(subscription, function(channel) {
      if (response.error) return;
      if (!local && !Faye.Channel.isSubscribable(channel)) response.error = Faye.Error.channelForbidden(channel);
      if (!Faye.Channel.isValid(channel))                  response.error = Faye.Error.channelInvalid(channel);
      
      if (response.error) return;
      channel = this._channels.findOrCreate(channel);
      
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
    
    Faye.each(subscription, function(channel) {
      if (response.error) return;
      
      if (!Faye.Channel.isValid(channel))
        return response.error = Faye.Error.channelInvalid(channel);
      
      channel = this._channels.get(channel);
      if (!channel) return;
      
      this.info('Unsubscribing client ? from ?', clientId, channel.name);
      connection.unsubscribe(channel);
    }, this);
    
    response.successful = !response.error;
    return response;
  }
});

Faye.extend(Faye.Server.prototype, Faye.Logging);
Faye.extend(Faye.Server.prototype, Faye.Extensible);

