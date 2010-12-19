Faye.WebSocketTransport = Faye.Class(Faye.Transport, {
  UNCONNECTED:    1,
  CONNECTING:     2,
  CONNECTED:      3,
  
  request: function(messages, timeout) {
    this._timeout = this._timeout || timeout;
    this._messages = this._messages || {};
    Faye.each(messages, function(message) {
      this._messages[message.id] = message;
    }, this);
    this.withSocket(function(socket) { socket.send(Faye.toJSON(messages)) });
  },
  
  withSocket: function(callback, scope) {
    this.callback(callback, scope);
    this.connect();
  },
  
  getSocketUrl: function() {
    return Faye.URI.parse(this._endpoint).toURL().replace(/^http(s?):/ig, 'ws$1:');
  },
  
  connect: function() {
    this._state = this._state || this.UNCONNECTED;
    if (this._state !== this.UNCONNECTED) return;
    
    this._state = this.CONNECTING;
    
    this._socket = new WebSocket(this.getSocketUrl());
    var self = this;
    
    this._socket.onopen = function() {
      delete self._timeout;
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
      var wasConnected = (self._state === self.CONNECTED);
      self.setDeferredStatus('deferred');
      self._state = self.UNCONNECTED;
      delete self._socket;
      
      if (wasConnected) return self.resend();
      
      setTimeout(function() { self.connect() }, 1000 * self._timeout);
      self._timeout = self._timeout * 2;
    };
  },
  
  resend: function() {
    var messages = Faye.map(this._messages, function(id, msg) { return msg });
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
});

Faye.XHRTransport.isUsable = function(endpoint) {
  return Faye.URI.parse(endpoint).isLocal();
};

Faye.Transport.register('long-polling', Faye.XHRTransport);


Faye.JSONPTransport = Faye.extend(Faye.Class(Faye.Transport, {
  request: function(message, timeout) {
    var params       = {message: Faye.toJSON(message)},
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

