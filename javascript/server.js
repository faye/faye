Faye.Server = Faye.Class({
  initialize: function(options) {
    this.info('New server created');
    this._options   = options || {};
    this._channels  = new Faye.Channel.Tree();
    this._clients   = {};
    this._namespace = new Faye.Namespace();
  },
  
  clientIds: function() {
    var ids = [];
    Faye.each(this._clients, function(key, value) { ids.push(key) });
    return ids;
  },
  
  process: function(messages, local, callback) {
    this.debug('Processing messages from ' + (local ? 'LOCAL' : 'REMOTE') + ' client');
    
    messages = [].concat(messages);
    var processed = 0, responses = [];
    
    Faye.each(messages, function(message) {
      this._handle(message, local, function(reply) {
        responses = responses.concat(reply);
        processed += 1;
        if (processed < messages.length) return;
        callback(responses);
      }, this);
    }, this);
  },
  
  flushConnection: function(messages) {
    messages = [].concat(messages);
    Faye.each(messages, function(message) {
      var client = this._clients[message.clientId];
      if (client) client.flush();
    }, this);
  },
  
  _connection: function(id) {
    if (this._clients.hasOwnProperty(id)) return this._clients[id];
    var client = new Faye.Connection(id, this._options);
    client.on('staleClient', this._destroyClient, this);
    return this._clients[id] = client;
  },
  
  _destroyClient: function(client) {
    client.disconnect();
    client.stopObserving('staleClient', this._destroyClient, this);
    delete this._clients[client.id];
  },
  
  _handle: function(message, local, callback, scope) {
    var channel = message.channel,
        response;
    
    message.__id = Faye.random();
    Faye.each(this._channels.glob(channel), function(c) {
      c.push(message);
      this.info('Publishing message ' + Faye.toJSON(message.data) +
                ' from client ' + clientId + ' to ' + c.name);
    }, this);
    
    if (Faye.Channel.isMeta(channel)) {
      response = this[Faye.Channel.parse(channel)[1]](message, local);
      
      var clientId = response.clientId;
      response.advice = response.advice || {};
      Faye.extend(response.advice, {
        reconnect:  this._clients.hasOwnProperty(clientId) ? 'retry' : 'handshake',
        interval:   Math.floor(Faye.Connection.prototype.INTERVAL * 1000)
      }, false);
      
      if (response.channel !== Faye.Channel.CONNECT ||
          response.successful !== true)
        return callback.call(scope, response);
      
      this.info('Accepting connection from ' + response.clientId);
      return this._connection(response.clientId).connect(function(events) {
        this.info('Sending event messages to ' + response.clientId);
        this.debug('Events for ' + response.clientId + ': ' + Faye.toJSON(events));
        Faye.each(events, function(e) { delete e.__id });
        callback.call(scope, [response].concat(events));
      }, this);
    }
    
    if (!message.clientId || Faye.Channel.isService(channel))
      return callback([]);
    
    response = this._makeResponse(message);
    response.successful = true;
    callback(response);
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
    
    var clientConns = message.supportedConnectionTypes || ['long-polling'],
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
    this.info('Accepting handshake from client ' + response.clientId);
    return response;
  },
  
  // MUST contain  * clientId
  //               * connectionType
  // MAY contain   * ext
  //               * id
  connect: function(message, local) {
    var response = this._makeResponse(message);
    
    var clientId = message.clientId,
        client   = clientId ? this._clients[clientId] : null,
        connectionType = message.connectionType;
    
    if (!client)         response.error = Faye.Error.clientUnknown(clientId);
    if (!clientId)       response.error = Faye.Error.parameterMissing('clientId');
    if (!connectionType) response.error = Faye.Error.parameterMissing('connectionType');
    
    response.successful = !response.error;
    if (!response.successful) delete response.clientId;
    if (!response.successful) return response;
    
    response.clientId = client.id;
    return response;
  },
  
  // MUST contain  * clientId
  // MAY contain   * ext
  //               * id
  disconnect: function(message, local) {
    var response = this._makeResponse(message);
    
    var clientId = message.clientId,
        client   = clientId ? this._clients[clientId] : null;
    
    if (!client)   response.error = Faye.Error.clientUnknown(clientId);
    if (!clientId) response.error = Faye.Error.parameterMissing('clientId');
    
    response.successful = !response.error;
    if (!response.successful) delete response.clientId;
    if (!response.successful) return response;
    
    this._destroyClient(client);
    
    this.info('Disconnected client: ' + clientId);
    response.clientId = clientId;
    return response;
  },
  
  // MUST contain  * clientId
  //               * subscription
  // MAY contain   * ext
  //               * id
  subscribe: function(message, local) {
    var response = this._makeResponse(message);
    
    var clientId     = message.clientId,
        client       = clientId ? this._clients[clientId] : null,
        subscription = message.subscription;
    
    subscription = [].concat(subscription);
    
    if (!client)               response.error = Faye.Error.clientUnknown(clientId);
    if (!clientId)             response.error = Faye.Error.parameterMissing('clientId');
    if (!message.subscription) response.error = Faye.Error.parameterMissing('subscription');
    
    response.subscription = subscription;
    
    Faye.each(subscription, function(channel) {
      if (response.error) return;
      if (!local && !Faye.Channel.isSubscribable(channel)) response.error = Faye.Error.channelForbidden(channel);
      if (!Faye.Channel.isValid(channel))                  response.error = Faye.Error.channelInvalid(channel);
      
      if (response.error) return;
      channel = this._channels.findOrCreate(channel);
      
      this.info('Subscribing client ' + clientId + ' to ' + channel.name);
      client.subscribe(channel);
    }, this);
    
    response.successful = !response.error;
    return response;
  },
  
  // MUST contain  * clientId
  //               * subscription
  // MAY contain   * ext
  //               * id
  unsubscribe: function(message, local) {
    var response = this._makeResponse(message);
    
    var clientId     = message.clientId,
        client       = clientId ? this._clients[clientId] : null,
        subscription = message.subscription;
    
    subscription = [].concat(subscription);
    
    if (!client)               response.error = Faye.Error.clientUnknown(clientId);
    if (!clientId)             response.error = Faye.Error.parameterMissing('clientId');
    if (!message.subscription) response.error = Faye.Error.parameterMissing('subscription');
    
    Faye.each(subscription, function(channel) {
      if (response.error) return;
      
      if (!Faye.Channel.isValid(channel))
        return response.error = Faye.Error.channelInvalid(channel);
      
      channel = this._channels.get(channel);
      if (!channel) return;
      
      this.info('Unsubscribing client ' + clientId + ' from ' + channel.name);
      client.unsubscribe(channel);
    }, this);
    
    response.successful = !response.error;
    return response;
  }
});

Faye.extend(Faye.Server.prototype, Faye.Logging);

