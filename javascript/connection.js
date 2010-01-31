Faye.Connection = Faye.Class({
  initialize: function(id, options) {
    this.id         = id;
    this._options   = options;
    this._observers = {};
    this._channels  = new Faye.Set();
    this._inbox     = new Faye.Set();
  },
  
  subscribe: function(channel) {
    if (!this._channels.add(channel)) return;
    channel.on('message', function(event) {
      this._inbox.add(event);
      this._beginDeliveryTimeout();
    }, this);
  },
  
  connect: function(callback) {
    this.on('flush', callback);
    if (this._connected) return;
    
    this._connected = true;
    if (!this._inbox.isEmpty()) this._beginDeliveryTimeout();
  },
  
  flush: function() {
    if (!this._connected) return;
    this._releaseConnection();
    
    var events = this._inbox.toArray();
    this._inbox = new Faye.Set();
    
    this.fire('flush', events);
  },
  
  _beginDeliveryTimeout: function() {
    if (  this._deliveryTimeout
       || !this._connected
       || this._inbox.isEmpty()
       )
      return;
    
    var self = this;
    this._deliveryTimeout = setTimeout(function () { self.flush() },
                                       Faye.Connection.MAX_DELAY);
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
    // TODO mark for deletion
  }
});

Faye.extend(Faye.Connection.prototype, Faye.Observable);

Faye.extend(Faye.Connection, {
  MAX_DELAY:  <%= Faye::Connection::MAX_DELAY %>,
  INTERVAL:   <%= Faye::Connection::INTERVAL %>,
  TIMEOUT:    <%= Faye::Connection::TIMEOUT %>
});

