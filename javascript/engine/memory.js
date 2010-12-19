Faye.Engine.Memory = Faye.Class(Faye.Engine.Base, {
  initialize: function(options) {
    this._namespace = new Faye.Namespace();
    Faye.Engine.Base.prototype.initialize.call(this, options);
  },
  
  createClientId: function(callback, scope) {
    var clientId = this._namespace.generate();
    callback.call(scope, clientId);
  }
});

