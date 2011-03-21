Faye.Engine = {
  register: function(type, klass) {
    this._backends = this._backends || {};
    this._backends[type] = klass;
  },
  
  get: function(options) {
    options = options || {};
    var klass = this._backends[options.type] || Faye.Engine.Memory;
    return new klass(options);
  }
};

Faye.Engine.Base = Faye.Class({
  MAX_DELAY:  <%= Faye::Engine::MAX_DELAY %>,
  INTERVAL:   <%= Faye::Engine::INTERVAL %>,
  TIMEOUT:    <%= Faye::Engine::TIMEOUT %>,
  
  initialize: function(options) {
    this._options     = options || {};
    this._connections = {};
    this.interval     = this._options.interval || this.INTERVAL;
    this.timeout      = this._options.timeout  || this.TIMEOUT;
  },
  
  connect: function(clientId, options, callback, scope) {
    var conn = this.connection(clientId, true);
    conn.connect(options, callback, scope);
    this.flush(clientId);
  },
  
  connection: function(clientId, create) {
    var conn = this._connections[clientId];
    if (conn || !create) return conn;
    return this._connections[clientId] = new Faye.Engine.Connection(this, clientId);
  },
  
  closeConnection: function(clientId) {
    delete this._connections[clientId];
  }
});

Faye.extend(Faye.Engine.Base.prototype, Faye.Timeouts);
