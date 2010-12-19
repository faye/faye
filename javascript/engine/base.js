Faye.Engine.Base = Faye.Class({
  initialize: function(options) {
    this._options   = options || {};
    this._listeners = [];
  },
  
  onMessage: function(callback, scope) {
    this._listeners.push([callback, scope]);
  },
  
  announce: function(clientId, message) {
    Faye.each(this._listeners, function(listener) {
      listener[0].call(listener[1], clientId, message);
    });
  }
});

Faye.extend(Faye.Engine.Base.prototype, Faye.Timeouts);

