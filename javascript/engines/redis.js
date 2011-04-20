Faye.Engine.Redis = Faye.Class(Faye.Engine.Base, {
  DEFAULT_HOST: '<%= Faye::Engine::Redis::DEFAULT_HOST %>',
  DEFAULT_PORT: <%= Faye::Engine::Redis::DEFAULT_PORT %>,
  
  initialize: function(options) {
    Faye.Engine.Base.prototype.initialize.call(this, options);
    
    var redis = require('redis'),
        host  = this._options.host || this.DEFAULT_HOST,
        port  = this._options.port || this.DEFAULT_PORT;
    
    this._redis = redis.createClient(port, host);
    this._subscriber = redis.createClient(port, host);
    
    var self = this;
    this._subscriber.subscribe('/notifications');
    this._subscriber.on('message', function(topic, message) {
      self.emptyQueue(message);
    });
  },
  
  disconnect: function() {
    this._redis.end();
    this._subscriber.unsubscribe();
    this._subscriber.end();
  },
  
  createClient: function(callback, scope) {
    var clientId = Faye.random(), self = this;
    this._redis.sadd('/clients', clientId, function(error, added) {
      if (added === 0) return self.createClient(callback, scope);
      self.ping(clientId);
      callback.call(scope, clientId);
    });
  },
  
  destroyClient: function(clientId, callback, scope) {
    var self = this;
    this._redis.srem('/clients', clientId);
    this._redis.del('/clients/' + clientId + '/messages');
    this._redis.smembers('/clients/' + clientId + '/channels', function(error, channels) {
      var n = channels.length, i = 0;
      if (n === 0) return callback && callback.call(scope);
      
      Faye.each(channels, function(channel) {
        self.unsubscribe(clientId, channel, function() {
          i += 1;
          if (i === n) callback && callback.call(scope);
        });
      });
    });
  },
  
  clientExists: function(clientId, callback, scope) {
    this._redis.sismember('/clients', clientId, function(error, exists) {
      callback.call(scope, exists !== 0);
    });
  },
  
  ping: function(clientId) {
    var timeout = this._options.timeout,
        time    = new Date().getTime().toString(),
        self    = this;
    
    if (typeof timeout !== 'number') return;
    
    this.removeTimeout(clientId);
    this._redis.set('/clients/' + clientId + '/ping', time);
    this.addTimeout(clientId, 2 * timeout, function() {
      this._redis.get('/clients/' + clientId + '/ping', function(error, ping) {
        if (ping === time) self.destroyClient(clientId);
      });
    }, this);
  },
  
  subscribe: function(clientId, channel, callback, scope) {
    this._redis.sadd('/clients/' + clientId + '/channels', channel);
    this._redis.sadd('/channels' + channel, clientId, function() {
      if (callback) callback.call(scope);
    });
  },
  
  unsubscribe: function(clientId, channel, callback, scope) {
    this._redis.srem('/clients/' + clientId + '/channels', channel);
    this._redis.srem('/channels' + channel, clientId, function() {
      if (callback) callback.call(scope);
    });
  },
  
  publish: function(message) {
    var jsonMessage = JSON.stringify(message),
        channels    = Faye.Channel.expand(message.channel),
        self        = this;
    
    Faye.each(channels, function(channel) {
      self._redis.smembers('/channels' + channel, function(error, clients) {
        Faye.each(clients, function(clientId) {
          self._redis.sadd('/clients/' + clientId + '/messages', jsonMessage);
          self._redis.publish('/notifications', clientId);
        });
      });
    });
  },
  
  emptyQueue: function(clientId) {
    var conn = this.connection(clientId, false);
    if (!conn) return;
    
    var key = '/clients/' + clientId + '/messages', self = this;
    this._redis.smembers(key, function(error, jsonMessages) {
      Faye.each(jsonMessages, function(jsonMessage) {
        self._redis.srem(key, jsonMessage);
        conn.deliver(JSON.parse(jsonMessage));
      });
    });
  }
});

Faye.Engine.register('redis', Faye.Engine.Redis);
