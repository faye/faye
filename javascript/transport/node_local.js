Faye.Transport.NodeLocal = Faye.extend(Faye.Class(Faye.Transport, {
  request: function(message, timeout) {
    this._endpoint.process(message, true, this.receive, this);
  }
}), {
  isUsable: function(endpoint, callback, scope) {
    callback.call(scope, endpoint instanceof Faye.Server);
  }
});

Faye.Transport.register('in-process', Faye.Transport.NodeLocal);
