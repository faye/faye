Faye.Engine.Redis = Faye.Class(Faye.Engine.Base, {
  DEFAULT_HOST:     '<%= Faye::Engine::Redis::DEFAULT_HOST %>',
  DEFAULT_PORT:     <%= Faye::Engine::Redis::DEFAULT_PORT %>,
  DEFAULT_DATABASE: <%= Faye::Engine::Redis::DEFAULT_DATABASE %>,
  DEFAULT_GC:       <%= Faye::Engine::Redis::DEFAULT_GC %>,
  
  className: 'Engine.Redis',

  initialize: function(options) {
    Faye.Engine.Base.prototype.initialize.call(this, options);
    
    var redis = require('redis'),
        host  = this._options.host     || this.DEFAULT_HOST,
        port  = this._options.port     || this.DEFAULT_PORT,
        db    = this._options.database || this.DEFAULT_DATABASE,
        auth  = this._options.password,
        gc    = this._options.gc       || this.DEFAULT_GC;
    
    this._ns  = this._options.namespace;
    
    this._redis = redis.createClient(port, host, {no_ready_check: true});
    this._subscriber = redis.createClient(port, host, {no_ready_check: true});
    
    if (auth) {
      this._redis.auth(auth);
      this._subscriber.auth(auth);
    }
    this._redis.select(db);
    this._subscriber.select(db);
    
    var self = this;
    this._subscriber.subscribe(this._ns + '/notifications');
    this._subscriber.on('message', function(topic, message) {
      self.emptyQueue(message);
    });
    
    this._gc = setInterval(function() { self.gc() }, gc * 1000);
  },
  
  disconnect: function() {
    this._redis.end();
    this._subscriber.unsubscribe();
    this._subscriber.end();
    clearInterval(this._gc);
  },
  
  createClient: function(callback, scope) {
    var clientId = Faye.random(), self = this;
    this.debug('Created new client ?', clientId);
    this._redis.zadd(this._ns + '/clients', 0, clientId, function(error, added) {
      if (added === 0) return self.createClient(callback, scope);
      self.ping(clientId);
      callback.call(scope, clientId);
    });
  },
  
  destroyClient: function(clientId, callback, scope) {
    var self = this;
    this._redis.zrem(this._ns + '/clients', clientId);
    this._redis.del(this._ns + '/clients/' + clientId + '/messages');
    
    this._redis.smembers(this._ns + '/clients/' + clientId + '/channels', function(error, channels) {
      var n = channels.length, i = 0;
      if (n === 0) return callback && callback.call(scope);
      
      Faye.each(channels, function(channel) {
        self.unsubscribe(clientId, channel, function() {
          i += 1;
          if (i === n) {
            self.debug('Destroyed client ?', clientId);
            if (callback) callback.call(scope);
          }
        });
      });
    });
  },
  
  clientExists: function(clientId, callback, scope) {
    this._redis.zscore(this._ns + '/clients', clientId, function(error, score) {
      callback.call(scope, score !== null);
    });
  },
  
  ping: function(clientId) {
    if (typeof this.timeout !== 'number') return;
    
    var time    = new Date().getTime(),
        self    = this;
    
    this.debug('Ping ?, ?', clientId, time);
    this._redis.zadd(this._ns + '/clients', time, clientId);
  },
  
  subscribe: function(clientId, channel, callback, scope) {
    var self = this;
    this._redis.sadd(this._ns + '/clients/' + clientId + '/channels', channel);
    this._redis.sadd(this._ns + '/channels' + channel, clientId, function() {
      self.debug('Subscribed client ? to channel ?', clientId, channel);
      if (callback) callback.call(scope);
    });
  },
  
  unsubscribe: function(clientId, channel, callback, scope) {
    var self = this;
    this._redis.srem(this._ns + '/clients/' + clientId + '/channels', channel);
    this._redis.srem(this._ns + '/channels' + channel, clientId, function() {
      self.debug('Unsubscribed client ? from channel ?', clientId, channel);
      if (callback) callback.call(scope);
    });
  },
  
  publish: function(message) {
    this.debug('Publishing message ?', message);

    var self        = this,
        jsonMessage = JSON.stringify(message),
        channels    = Faye.Channel.expand(message.channel),
        keys        = Faye.map(channels, function(c) { return self._ns + '/channels' + c });
    
    var notify = function(error, clients) {
      Faye.each(clients, function(clientId) {
        self.debug('Queueing for client ?: ?', clientId, message);
        self._redis.rpush(self._ns + '/clients/' + clientId + '/messages', jsonMessage);
        self._redis.publish(self._ns + '/notifications', clientId);
      });
    };
    keys.push(notify);
    this._redis.sunion.apply(this._redis, keys);
  },
  
  emptyQueue: function(clientId) {
    var conn = this.connection(clientId, false);
    if (!conn) return;
    
    var key = this._ns + '/clients/' + clientId + '/messages', self = this;
    this._redis.lrange(key, 0, -1, function(error, jsonMessages) {
      self._redis.ltrim(key, jsonMessages.length, -1);
      Faye.each(jsonMessages, function(jsonMessage) {
        self._redis.srem(key, jsonMessage);
        conn.deliver(JSON.parse(jsonMessage));
      });
    });
  },
  
  gc: function() {
    if (typeof this.timeout !== 'number') return;
    
    var cutoff = new Date().getTime() - 1000 * 2 * this.timeout,
        self   = this;
    
    this._redis.zrangebyscore(this._ns + '/clients', 0, cutoff, function(error, clients) {
      Faye.each(clients, function(clientId) { self.destroyClient(clientId) });
    });
  }
});

Faye.Engine.register('redis', Faye.Engine.Redis);
