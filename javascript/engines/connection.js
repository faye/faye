Faye.Engine.Connection = Faye.Class({
  initialize: function(engine, id, options) {
    this._engine  = engine;
    this.id       = id;
    this._options = options;
    this._inbox   = new Faye.Set();
  },
  
  deliver: function(message) {
    if (!this._inbox.add(message)) return;
    this._beginDeliveryTimeout();
  },
  
  connect: function(options, callback, scope) {
    options = options || {};
    var timeout = (options.timeout !== undefined) ? options.timeout / 1000 : this._engine.timeout;
    
    this.setDeferredStatus('deferred');
    
    this.callback(callback, scope);
    if (this._connected) return;
    
    this._connected = true;
    
    this._beginDeliveryTimeout();
    this._beginConnectionTimeout(timeout);
  },
  
  flush: function() {
    this._releaseConnection();
    this.setDeferredStatus('succeeded', this._inbox.toArray());
  },
  
  _releaseConnection: function() {
    this._engine.closeConnection(this.id);
    this.removeTimeout('connection');
    this.removeTimeout('delivery');
    this._connected = false;
  },
  
  _beginDeliveryTimeout: function() {
    if (this._inbox.isEmpty()) return;
    this.addTimeout('delivery', this._engine.MAX_DELAY, this.flush, this);
  },
  
  _beginConnectionTimeout: function(timeout) {
    this.addTimeout('connection', timeout, this.flush, this);
  }
});

Faye.extend(Faye.Engine.Connection.prototype, Faye.Deferrable);
Faye.extend(Faye.Engine.Connection.prototype, Faye.Timeouts);

