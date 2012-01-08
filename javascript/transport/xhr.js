Faye.Transport.XHR = Faye.extend(Faye.Class(Faye.Transport, {
  request: function(message, timeout) {
    var retry = this.retry(message, timeout),
        path  = Faye.URI.parse(this._endpoint).pathname,
        self  = this,
        xhr   = Faye.ENV.ActiveXObject
              ? new ActiveXObject("Microsoft.XMLHTTP")
              : new XMLHttpRequest();
    
    xhr.open('POST', path, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== 4) return;
      var status = xhr.status;
      try {
        var parsedMessage;
        if ((status >= 200 && status < 300) || status === 304 || status === 1223) {
          try {
            parsedMessage = JSON.parse(xhr.responseText);
          } catch (e) {
          }
        }
        if (parsedMessage) {
          self.receive(parsedMessage);
          self.trigger('up');
        } else {
          retry();
          self.trigger('down');
        }
      } catch (e) {
        retry();
      } finally {
        Faye.Event.detach(Faye.ENV, 'beforeunload', abort);
        xhr.onreadystatechange = function() {};
        xhr = null;
      }
    };

    var abort = function() { xhr.abort() };
    Faye.Event.on(Faye.ENV, 'beforeunload', abort);
    
    xhr.send(Faye.toJSON(message));
  }
}), {
  isUsable: function(endpoint, callback, scope) {
    callback.call(scope, Faye.URI.parse(endpoint).isLocal());
  }
});

Faye.Transport.register('long-polling', Faye.Transport.XHR);
