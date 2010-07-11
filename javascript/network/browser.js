Faye.WebSocketTransport = Faye.Class(Faye.Transport, {
  UNCONNECTED:    1,
  CONNECTING:     2,
  CONNECTED:      3,
  
  request: function(messages) {
    this._messages = this._messages || {};
    Faye.each(messages, function(message) {
      this._messages[message.id] = message;
    }, this);
    this.withSocket(function(socket) { socket.send(Faye.toJSON(messages)) });
  },
  
  withSocket: function(callback, scope) {
    this.callback(callback, scope);
    
    this._state = this._state || this.UNCONNECTED;
    if (this._state !== this.UNCONNECTED) return;
    
    this._state = this.CONNECTING;
    
    var socketUrl = Faye.URI.parse(this._endpoint).toURL().
                    replace(/^https?/ig, 'ws');
    
    this._socket = new WebSocket(socketUrl);
    var self = this;
    
    this._socket.onopen = function() {
      self._state = self.CONNECTED;
      self.setDeferredStatus('succeeded', self._socket);
    };
    
    this._socket.onmessage = function(event) {
      var messages = [].concat(JSON.parse(event.data));
      Faye.each(messages, function(message) {
        delete self._messages[message.id];
      });
      self.receive(messages);
    };
    
    this._socket.onclose = function() {
      self.setDeferredStatus('deferred');
      self._state = self.UNCONNECTED;
      self._socket = null;
      self.resend();
    };
  },
  
  resend: function() {
    var messages = [];
    for (var id in this._messages) {
      if (!this._messages.hasOwnProperty(id)) continue;
      messages.push(this._messages[id]);
    }
    this.request(messages);
  }
});

Faye.extend(Faye.WebSocketTransport.prototype, Faye.Deferrable);


Faye.WebSocketTransport.isUsable = function(endpoint) {
  return !!Faye.ENV.WebSocket;
};

Faye.Transport.register('websocket', Faye.WebSocketTransport);


Faye.XHRTransport = Faye.Class(Faye.Transport, {
  request: function(message, timeout) {
    var timeout = timeout || this._client.getTimeout();
    
    Faye.XHR.request('post', this._endpoint, Faye.toJSON(message), {
      success:function(response) {
       this.receive(JSON.parse(response.text()));
      },
      failure: function() {
        var self = this;
        setTimeout(function() { self.request(message, 2 * timeout) }, 1000 * timeout);
      }
    }, this);
  }
});

Faye.XHRTransport.isUsable = function(endpoint) {
  return Faye.URI.parse(endpoint).isLocal();
};

Faye.Transport.register('long-polling', Faye.XHRTransport);


Faye.JSONPTransport = Faye.extend(Faye.Class(Faye.Transport, {
  request: function(message, timeout) {
    var timeout      = timeout || this._client.getTimeout() * 2,
        params       = {message: Faye.toJSON(message)},
        head         = document.getElementsByTagName('head')[0],
        script       = document.createElement('script'),
        callbackName = Faye.JSONPTransport.getCallbackName(),
        location     = Faye.URI.parse(this._endpoint, params),
        self         = this;
    
    var removeScript = function() {
      if (!script.parentNode) return false;
      script.parentNode.removeChild(script);
      return true;
    };
    
    Faye.ENV[callbackName] = function(data) {
      Faye.ENV[callbackName] = undefined;
      try { delete Faye.ENV[callbackName] } catch (e) {}
      if (!removeScript()) return;
      self.receive(data);
    };
    
    setTimeout(function() {
      if (!Faye.ENV[callbackName]) return;
      removeScript();
      self.request(message, 2 * timeout);
    }, 1000 * timeout);
    
    location.params.jsonp = callbackName;
    script.type = 'text/javascript';
    script.src  = location.toURL();
    head.appendChild(script);
  }
}), {
  _cbCount: 0,
  
  getCallbackName: function() {
    this._cbCount += 1;
    return '__jsonp' + this._cbCount + '__';
  }
});

Faye.JSONPTransport.isUsable = function(endpoint) {
  return true;
};

Faye.Transport.register('callback-polling', Faye.JSONPTransport);

