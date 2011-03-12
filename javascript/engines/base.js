Faye.Engine = {
  get: function(type, options) {
    return new Faye.Engine.Memory(options);
  }
};

Faye.Engine.Base = Faye.Class({
  initialize: function(options) {
    this._options = options || {};
  },
  
  announce: function(clientId, message) {
    this.publishEvent('message', clientId, message);
  }
});

Faye.extend(Faye.Engine.Base.prototype, Faye.Publisher);
Faye.extend(Faye.Engine.Base.prototype, Faye.Timeouts);
