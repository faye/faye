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
      } finally {
        xhr.onload = xhr.onerror = null;
        xhr = null;
      }
    };
    xhr.onerror = retry;
    xhr.onprogress = function() {};
    xhr.send('message=' + encodeURIComponent(Faye.toJSON(message)));
  }
}), {
  isUsable: function(endpoint, callback, scope) {
    if (Faye.URI.parse(endpoint).isLocal())
      return callback.call(scope, false);
    
    if (Faye.ENV.XDomainRequest)
      return callback.call(scope, true);
    
    if (Faye.ENV.XMLHttpRequest) {
      var xhr = new Faye.ENV.XMLHttpRequest();
      return callback.call(scope, xhr.withCredentials !== undefined);
    }
    return callback.call(scope, false);
  }
});

Faye.Transport.register('cross-origin-long-polling', Faye.Transport.CORS);

