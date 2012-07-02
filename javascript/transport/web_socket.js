Faye.Transport.WebSocket = Faye.extend(Faye.Class(Faye.Transport, {
  UNCONNECTED:  <%= Faye::Transport::WebSocket::UNCONNECTED %>,
  CONNECTING:   <%= Faye::Transport::WebSocket::CONNECTING %>,
  CONNECTED:    <%= Faye::Transport::WebSocket::CONNECTED %>,

  batching:     false,
  
  request: function(messages, timeout) {
    if (messages.length === 0) return;
    this._messages = this._messages || {};
    
    for (var i = 0, n = messages.length; i < n; i++) {
      this._messages[messages[i].id] = messages[i];
    }
    this.withSocket(function(socket) { socket.send(Faye.toJSON(messages)) });
  },
  
  withSocket: function(callback, context) {
    this.callback(callback, context);
    this.connect();
  },
  
  close: function() {
    if (this._closed) return;
    this._closed = true;
    if (this._socket) this._socket.close();
  },
  
  connect: function() {
    if (Faye.Transport.WebSocket._unloaded) return;
    if (this._closed) return;
    
    this._state = this._state || this.UNCONNECTED;
    if (this._state !== this.UNCONNECTED) return;
    
    this._state = this.CONNECTING;
    
    var ws = Faye.Transport.WebSocket.getClass();
    this._socket = new ws(Faye.Transport.WebSocket.getSocketUrl(this._endpoint));
    var self = this;
    
    this._socket.onopen = function() {
      self._state = self.CONNECTED;
      self.setDeferredStatus('succeeded', self._socket);
      self.trigger('up');
    };
    
    this._socket.onmessage = function(event) {
      var messages = [].concat(JSON.parse(event.data));
      for (var i = 0, n = messages.length; i < n; i++) {
        delete self._messages[messages[i].id];
      }
      self.receive(messages);
    };
    
    this._socket.onclose = function() {
      var wasConnected = (self._state === self.CONNECTED);
      self.setDeferredStatus('deferred');
      self._state = self.UNCONNECTED;
      delete self._socket;
      
      if (wasConnected) return self.resend();
      
      var retry = self._client.retry * 1000;
      Faye.ENV.setTimeout(function() { self.connect() }, retry);
      self.trigger('down');
    };
  },
  
  resend: function() {
    var messages = Faye.map(this._messages, function(id, msg) { return msg });
    this.request(messages);
  }
}), {
  WEBSOCKET_TIMEOUT: 1000,
  
  getSocketUrl: function(endpoint) {
    if (Faye.URI) endpoint = Faye.URI.parse(endpoint).toURL();
    return endpoint.replace(/^http(s?):/ig, 'ws$1:');
  },
  
  getClass: function() {
    return (Faye.WebSocket && Faye.WebSocket.Client) ||
            Faye.ENV.WebSocket ||
            Faye.ENV.MozWebSocket;
  },
  
  isUsable: function(endpoint, callback, context) {
    var ws = this.getClass();
    if (!ws) return callback.call(context, false);
    
    var connected = false,
        called    = false,
        socketUrl = this.getSocketUrl(endpoint),
        socket    = new ws(socketUrl);
    
    socket.onopen = function() {
      connected = true;
      socket.close();
      callback.call(context, true);
      called = true;
      socket = null;
    };
    
    var notconnected = function() {
      if (!called && !connected) callback.call(context, false);
      called = true;
    };
    
    socket.onclose = socket.onerror = notconnected;
    Faye.ENV.setTimeout(notconnected, this.WEBSOCKET_TIMEOUT);
  }
});

Faye.extend(Faye.Transport.WebSocket.prototype, Faye.Deferrable);
Faye.Transport.register('websocket', Faye.Transport.WebSocket);

if (Faye.Event)
  Faye.Event.on(Faye.ENV, 'beforeunload', function() {
    Faye.Transport.WebSocket._unloaded = true;
  });

