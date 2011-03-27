Faye.Transport.CORS = Faye.extend(Faye.Class(Faye.Transport, {
  request: function(message, timeout) {
    var self  = this,
        retry = this.retry(message, timeout),
        xhr   = new (Faye.ENV.XDomainRequest 
                  ? Faye.ENV.XDomainRequest 
                  : Faye.ENV.XMLHttpRequest)(),
        url   = Faye.URI.parse(this._endpoint).toURL();
        
    xhr.open('POST', url, true);
    if (xhr.setRequestHeader) xhr.setRequestHeader('Content-Type', 'text/plain');
    xhr.onload = function() {
      try {
        self.receive(JSON.parse(xhr.responseText));
      } catch(e) {
        retry();
      }
    };
    xhr.onerror = retry;
    xhr.send(Faye.toJSON(message));
  }
}), {
  isUsable: function(endpoint, callback, scope) {
    var isUsable = false;
    if(!Faye.URI.parse(endpoint).isLocal()) {
      if (Faye.ENV.XDomainRequest) {
        isUsable = true;
      } else if (Faye.ENV.XMLHttpRequest) {
        var xhr = new Faye.ENV.XMLHttpRequest();
        isUsable = "withCredentials" in xhr;
      }
    }
    callback.call(scope, isUsable);
  }
});

Faye.Transport.register('cross-origin-long-polling', Faye.Transport.CORS);

