Faye.Transport.NodeLocal = Faye.extend(Faye.Class(Faye.Transport, {
  batching: false,
  
  request: function(message, timeout) {
    message = Faye.copyObject(message);
    this._endpoint.process(message, true, null, function(responses) {
      this.receive(Faye.copyObject(responses));
    }, this);
  }
}), {
  isUsable: function(endpoint, callback, scope) {
    callback.call(scope, endpoint instanceof Faye.Server);
  }
});

Faye.Transport.register('in-process', Faye.Transport.NodeLocal);
