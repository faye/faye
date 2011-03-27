Faye.Transport.CORS = Faye.extend(Faye.Class(Faye.Transport, {
  request: function(message, timeout) {
    var xhrClass = Faye.ENV.XDomainRequest ? XDomainRequest : XMLHttpRequest,
        xhr      = new xhrClass(),
        retry    = this.retry(message, timeout),
        self     = this;
    
    xhr.open('POST', this._endpoint, true);
    xhr.onload = function() {
      try {
        self.receive(JSON.parse(xhr.responseText));
      } catch(e) {
        retry();
      }
    };
    xhr.onerror = retry;
    xhr.send('message=' + encodeURIComponent(Faye.toJSON(message)));
  }
}), {
  isUsable: function(endpoint, callback, scope) {
    if (Faye.URI.parse(endpoint).isLocal()) return callback.call(scope, false);
    
    if (Faye.ENV.XDomainRequest) {
      callback.call(scope, true);
    } else if (Faye.ENV.XMLHttpRequest) {
      var xhr = new Faye.ENV.XMLHttpRequest();
      callback.call(scope, xhr.withCredentials !== undefined);
    }
  }
});

Faye.Transport.register('cross-origin-long-polling', Faye.Transport.CORS);

