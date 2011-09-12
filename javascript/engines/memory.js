Faye.Engine.Memory = Faye.Class(Faye.Engine.Base, {
  className: 'Engine.Memory',

  initialize: function(options) {
    this._namespace = new Faye.Namespace();
    this._clients   = {};
    this._channels  = {};
    this._messages  = {};
    
    Faye.Engine.Base.prototype.initialize.call(this, options);
  },
  
  createClient: function(callback, scope) {
    var clientId = this._namespace.generate();
    this.debug('Created new client ?', clientId);
    this.ping(clientId);
    this.trigger('handshake', clientId);
    callback.call(scope, clientId);
  },
  
  destroyClient: function(clientId, callback, scope) {
    var clients = this._clients;
    if (!this._namespace.exists(clientId)) return;
    
    if (clients[clientId])
      clients[clientId].forEach(function(channel) { this.unsubscribe(clientId, channel) }, this);
    
    this.removeTimeout(clientId);
    this._namespace.release(clientId);
    delete this._messages[clientId];
    this.debug('Destroyed client ?', clientId);
    this.trigger('disconnect', clientId);
    if (callback) callback.call(scope);
  },
  
  clientExists: function(clientId, callback, scope) {
    callback.call(scope, this._namespace.exists(clientId));
  },
  
  ping: function(clientId) {
    if (typeof this.timeout !== 'number') return;
    this.debug('Ping ?, ?', clientId, this.timeout);
    this.removeTimeout(clientId);
    this.addTimeout(clientId, 2 * this.timeout, function() {
      this.destroyClient(clientId);
    }, this);
  },
  
  subscribe: function(clientId, channel, callback, scope) {
    var clients = this._clients, channels = this._channels;
    
    clients[clientId] = clients[clientId] || new Faye.Set();
    clients[clientId].add(channel);
    
    channels[channel] = channels[channel] || new Faye.Set();
    channels[channel].add(clientId);
    
    this.debug('Subscribed client ? to channel ?', clientId, channel);
    this.trigger('subscribe', clientId, channel);
    if (callback) callback.call(scope, true);
  },
  
  unsubscribe: function(clientId, channel, callback, scope) {
    var clients  = this._clients,
        channels = this._channels,
        trigger  = false;
    
    if (clients[clientId]) {
      trigger = clients[clientId].remove(channel);
      if (clients[clientId].isEmpty()) delete clients[clientId];
    }
    
    if (channels[channel]) {
      channels[channel].remove(clientId);
      if (channels[channel].isEmpty()) delete channels[channel];
    }
    
    this.debug('Unsubscribed client ? from channel ?', clientId, channel);
    if (trigger) this.trigger('unsubscribe', clientId, channel);
    if (callback) callback.call(scope, true);
  },
  
  publish: function(message) {
    this.debug('Publishing message ?', message);

    var channels = Faye.Channel.expand(message.channel),
        messages = this._messages,
        clients  = new Faye.Set();
    
    Faye.each(channels, function(channel) {
      var subs = this._channels[channel];
      if (!subs) return;
      subs.forEach(clients.add, clients);
    }, this);
    
    clients.forEach(function(clientId) {
      this.debug('Queueing for client ?: ?', clientId, message);
      messages[clientId] = messages[clientId] || [];
      messages[clientId].push(message);
      this.emptyQueue(clientId);
    }, this);
    
    this.trigger('publish', message.clientId, message.channel, message.data);
  },
  
  emptyQueue: function(clientId) {
    var conn = this.connection(clientId, false),
        messages = this._messages[clientId];
    
    if (!conn || !messages) return;
    delete this._messages[clientId];
    Faye.each(messages, conn.deliver, conn);
  }
});
Faye.extend(Faye.Engine.Memory.prototype, Faye.Timeouts);

Faye.Engine.register('memory', Faye.Engine.Memory);
