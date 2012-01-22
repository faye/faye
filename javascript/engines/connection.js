Faye.Engine.Connection = Faye.Class({
  initialize: function(engine, id, options) {
    this._engine  = engine;
    this._id      = id;
    this._options = options;
    this._inbox   = [];
  },
  
  deliver: function(message) {
    if (this.socket) return this.socket.send(JSON.stringify([message]));
    this._inbox.push(message);
    this._beginDeliveryTimeout();
  },
  
  connect: function(options, callback, context) {
    options = options || {};
    var timeout = (options.timeout !== undefined) ? options.timeout / 1000 : this._engine.timeout;
    
    this.setDeferredStatus('deferred');
    this.callback(callback, context);
    
    this._beginDeliveryTimeout();
    this._beginConnectionTimeout(timeout);
  },
  
  flush: function(force) {
    this._releaseConnection(force);
    this.setDeferredStatus('succeeded', this._inbox);
    this._inbox = [];
  },
  
  _releaseConnection: function(force) {
    if (force || !this.socket) this._engine.closeConnection(this._id);
    this.removeTimeout('connection');
    this.removeTimeout('delivery');
  },
  
  _beginDeliveryTimeout: function() {
    if (this._inbox.length === 0) return;
    this.addTimeout('delivery', this._engine.MAX_DELAY, this.flush, this);
  },
  
  _beginConnectionTimeout: function(timeout) {
    this.addTimeout('connection', timeout, this.flush, this);
  }
});

Faye.extend(Faye.Engine.Connection.prototype, Faye.Deferrable);
Faye.extend(Faye.Engine.Connection.prototype, Faye.Timeouts);

