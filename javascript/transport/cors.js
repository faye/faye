Faye.Transport.CORS = Faye.extend(Faye.Class(Faye.Transport, {
  xhr: null,
  request: function(message, timeout) {
    var xhrClass = Faye.ENV.XDomainRequest ? XDomainRequest : XMLHttpRequest,
        retry    = this.retry(message, timeout),
        self     = this;

    if (!this.xhr) {
      this.xhr = new xhrClass();
      this.xhr.timeout = 100000; 
    } else {
      try { this.xhr.abort(); } catch(e){}
    }
    
    this.xhr.open('POST', this._endpoint, true);
    this.xhr.onload = function() {
      try {
        self.receive(JSON.parse(self.xhr.responseText));
      } catch(e) {
        retry();
      }
    };
    this.xhr.onerror = retry;
    this.xhr.ontimeout = retry;
    this.xhr.onprogress = function() {};
    this.xhr.send('message=' + encodeURIComponent(Faye.toJSON(message)));
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

