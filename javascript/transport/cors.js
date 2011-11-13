Faye.Transport.CORS = Faye.extend(Faye.Class(Faye.Transport, {
  request: function(message, timeout) {
    var xhrClass = Faye.ENV.XDomainRequest ? XDomainRequest : XMLHttpRequest,
        xhr      = new xhrClass(),
        retry    = this.retry(message, timeout),
        self     = this;
    
    xhr.open('POST', this._endpoint, true);
    
    var cleanUp = function() {
      if (!xhr) return false;
      xhr.onload = xhr.onerror = xhr.ontimeout = xhr.onprogress = null;
      xhr = null;
      Faye.ENV.clearTimeout(timer);
      return true;
    };
    
    xhr.onload = function() {
      try {
        self.receive(JSON.parse(xhr.responseText));
        self.trigger('up');
      } catch(e) {
        retry();
      } finally {
        cleanUp();
      }
    };
    
    var onerror = function() {
      cleanUp();
      retry();
      self.trigger('down');
    };
    var timer = Faye.ENV.setTimeout(onerror, 1.5 * 1000 * timeout);
    xhr.onerror = onerror;
    xhr.ontimeout = onerror;
    
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

