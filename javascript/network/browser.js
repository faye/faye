Faye.WebSocketTransport = Faye.Class(Faye.Transport, {
  UNCONNECTED:    1,
  CONNECTING:     2,
  CONNECTED:      3,
  
  request: function(message) {
    if (message.channel === Faye.Channel.CONNECT)
      this._connectMessage = message;
    
    this.withSocket(function(socket) { socket.send(Faye.toJSON(message)) });
    return this;
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
    
    this._socket.onmessage = function(message) {
      self.receive(JSON.parse(message.data));
    };
    
    this._socket.onclose = function() {
      self._state = self.UNCONNECTED;
      self.setDeferredStatus('deferred');
      self._socket = null;
      self.request(self._connectMessage);
    };
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
    
    return Faye.XHR.request('post', this._endpoint, Faye.toJSON(message), {
      success:function(response) {
       this.receive(JSON.parse(response.text()));
      },
      failure: function() {
        var self = this;
        setTimeout(function() { self.request(message, 2 * timeout) }, 1000 * timeout);
      }
    }, this);
  },
  
  abort: function(request) {
    request.abort();
  }
});

Faye.XHRTransport.isUsable = function(endpoint) {
  return Faye.URI.parse(endpoint).isLocal();
};

Faye.Transport.register('long-polling', Faye.XHRTransport);


Faye.JSONPTransport = Faye.extend(Faye.Class(Faye.Transport, {
  request: function(message) {
    var params       = {message: Faye.toJSON(message)},
        head         = document.getElementsByTagName('head')[0],
        script       = document.createElement('script'),
        callbackName = Faye.JSONPTransport.getCallbackName(),
        location     = Faye.URI.parse(this._endpoint, params),
        self         = this;
    
    Faye.ENV[callbackName] = function(data) {
      Faye.ENV[callbackName] = undefined;
      try { delete Faye.ENV[callbackName] } catch (e) {}
      if (!script.parentNode) return;
      head.removeChild(script);
      self.receive(data);
    };
    
    location.params.jsonp = callbackName;
    script.type = 'text/javascript';
    script.src  = location.toURL();
    head.appendChild(script);
    
    return script;
  },
  
  abort: function(script) {
    if (!script.parentNode) return;
    script.parentNode.removeChild(script);
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

