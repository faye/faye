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
  
  }
});

Faye.extend(Faye.Connection.prototype, Faye.Observable);
Faye.Connection.INTERVAL = <%= Faye::Connection::INTERVAL %>;

