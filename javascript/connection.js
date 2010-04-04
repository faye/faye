Faye.Connection = Faye.Class({
  MAX_DELAY:  <%= Faye::Connection::MAX_DELAY %>,
  INTERVAL:   <%= Faye::Connection::INTERVAL %>,
  TIMEOUT:    <%= Faye::Connection::TIMEOUT %>,
  
  initialize: function(id, options) {
    this.id         = id;
    this._options   = options;
    this._timeout   = this._options.timeout || this.TIMEOUT;
    this._channels  = new Faye.Set();
    this._inbox     = new Faye.Set();
    this._connected = false
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
  
  connect: function(callback, scope) {
    this.callback(callback, scope);
    if (this._connected) return;
    
    this._connected = true;
    this.removeTimeout('deletion');
    
    this._beginDeliveryTimeout();
    this._beginConnectionTimeout();
  },
  
  flush: function() {
    if (!this._connected) return;
    this._releaseConnection();
    
    var events = this._inbox.toArray();
    this._inbox = new Faye.Set();
    
    this.setDeferredStatus('succeeded', events);
    this.setDeferredStatus('deferred');
  },
  
  disconnect: function() {
    this.unsubscribe('all');
    this.flush();
  },
  
  _beginDeliveryTimeout: function() {
    if (!this._connected || this._inbox.isEmpty()) return;
    this.addTimeout('delivery', this.MAX_DELAY, this.flush, this);
  },
  
  _beginConnectionTimeout: function() {
    if (!this._connected) return;
    this.addTimeout('connection', this._timeout, this.flush, this);
  },
  
  _releaseConnection: function() {
    this.removeTimeout('connection');
    this.removeTimeout('delivery');
    this._connected = false;
    
    this.addTimeout('deletion', 10 * this.INTERVAL, function() {
      this.fire('staleClient', this);
    }, this);
  }
});

Faye.extend(Faye.Connection.prototype, Faye.Deferrable);
Faye.extend(Faye.Connection.prototype, Faye.Observable);
Faye.extend(Faye.Connection.prototype, Faye.Timeouts);

