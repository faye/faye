Faye.Connection = Faye.Class({
  initialize: function(id, options) {
    this.id         = id;
    this._options   = options;
    this._observers = {};
    this._channels  = new Faye.Set();
    this._inbox     = new Faye.Set();
  },
  
  timeout: function() {
    return this._options.timeout || Faye.Connection.TIMEOUT;
  },
  
  _onMessage: function(event) {
    this._inbox.add(event);
    this._beginDeliveryTimeout();
  },
  
  subscribe: function(channel) {
    if (!this._channels.add(channel)) return;
    channel.on('message', this._onMessage, this);
  },
  
  unsubscribe: function(channel) {
    if (channel === 'all') return this._channels.forEach(this.unsubscribe, this);
    if (!this._channels.member(channel)) return;
    this._channels.remove(channel);
    channel.stopObserving('message', this._onMessage, this);
  },
  
  connect: function(callback) {
    this.on('flush', callback);
    if (this._connected) return;
    
    this._markForDeletion = false;
    this._connected       = true;
    
    if (!this._inbox.isEmpty()) this._beginDeliveryTimeout();
    this._beginConnectionTimeout();
  },
  
  flush: function() {
    if (!this._connected) return;
    this._releaseConnection();
    
    var events = this._inbox.toArray();
    this._inbox = new Faye.Set();
    
    this.fire('flush', events);
    this.stopObserving('flush');
  },
  
  disconnect: function() {
    this.unsubscribe('all');
    this.flush();
  },
  
  _beginDeliveryTimeout: function() {
    if (this._deliveryTimeout || !this._connected || this._inbox.isEmpty())
      return;
    
    var self = this;
    this._deliveryTimeout = setTimeout(function () { self.flush() },
                                       Faye.Connection.MAX_DELAY * 1000);
  },
  
  _beginConnectionTimeout: function() {
    if (this._connectionTimeout || !this._connected)
      return;
    
    var self = this;
    this._connectionTimeout = setTimeout(function() { self.flush() },
                                         this.timeout() * 1000);
  },
  
  _releaseConnection: function() {
    if (this._connectionTimeout) {
      clearTimeout(this._connectionTimeout);
      delete this._connectionTimeout;
    }
    
    if (this._deliveryTimeout) {
      clearTimeout(this._deliveryTimeout);
      delete this._deliveryTimeout;
    }
    
    this._connected = false;
    this._scheduleForDeletion();
  },
  
  _scheduleForDeletion: function() {
    if (this._markForDeletion) return;
    this._markForDeletion = true;
    var self = this;
    
    setTimeout(function() {
      if (!self._markForDeletion) return;
      self.fire('stale', self);
    }, 10000 * Faye.Connection.INTERVAL);
  }
});

Faye.extend(Faye.Connection.prototype, Faye.Observable);

Faye.extend(Faye.Connection, {
  MAX_DELAY:  <%= Faye::Connection::MAX_DELAY %>,
  INTERVAL:   <%= Faye::Connection::INTERVAL %>,
  TIMEOUT:    <%= Faye::Connection::TIMEOUT %>
});

