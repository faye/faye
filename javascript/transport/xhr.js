Faye.Transport.XHR = Faye.extend(Faye.Class(Faye.Transport, {
  request: function(message, timeout) {
    var retry = this.retry(message, timeout);
    
    Faye.XHR.request('post', this._endpoint, Faye.toJSON(message), {
      success:function(response) {
        try {
          this.receive(JSON.parse(response.text()));
        } catch (e) {
          retry();
        }
      },
      failure: retry
    }, this);
  }
}), {
  isUsable: function(endpoint, callback, scope) {
    callback.call(scope, Faye.URI.parse(endpoint).isLocal());
  }
});

Faye.Transport.register('long-polling', Faye.Transport.XHR);
