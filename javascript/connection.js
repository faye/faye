Faye.Connection = Faye.Class({
  initialize: function(id, options) {
    this.id         = id;
    this._options   = options;
    this._observers = {};
    this._channels  = new Faye.Set();
    this._inbox     = new Faye.Set();
  },
  
  on: function(eventType, block, scope) {
    var list = this._observers[eventType] = this._observers[eventType] || [];
    list.push([block, scope]);
  }
});

Faye.Connection.INTERVAL = <%= Faye::Connection::INTERVAL %>;

