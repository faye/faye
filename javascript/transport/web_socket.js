Faye.Transport.WebSocket = Faye.extend(Faye.Class(Faye.Transport, {
  UNCONNECTED:  1,
  CONNECTING:   2,
  CONNECTED:    3,

  batching:     false,
  
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
  
  connect: function() {
    this._state = this._state || this.UNCONNECTED;
    if (this._state !== this.UNCONNECTED) return;
    
    this._state = this.CONNECTING;
    
    this._socket = new WebSocket(Faye.Transport.WebSocket.getSocketUrl(this._endpoint));
    var self = this;
    
    this._socket.onopen    = function() { self.onOpen() };
    this._socket.onclose   = function() { self.onClose() };
    this._socket.onmessage = function(event) { self.onMessage(event) };
  },
  
  onOpen: function() {
    delete this._timeout;
    this._state = self.CONNECTED;
    this.setDeferredStatus('succeeded', this._socket);
  },
  
  onMessage: function(event) {
    var messages = [].concat(JSON.parse(event.data));
    Faye.each(messages, function(message) {
      delete this._messages[message.id];
    }, this);
    this.receive(messages);
  },
  
  onClose: function() {
    var wasConnected = (this._state === this.CONNECTED),
        self = this;
    
    this.setDeferredStatus('deferred');
    this._state = this.UNCONNECTED;
    delete this._socket;
    
    if (wasConnected) return this.resend();
    
    Faye.ENV.setTimeout(function() { self.connect() }, 1000 * this._timeout);
    this._timeout = this._timeout * 2;
  },
  
  resend: function() {
    var messages = Faye.map(this._messages, function(id, msg) { return msg });
    this.request(messages);
  }
}), {
  WEBSOCKET_TIMEOUT: 1000,
  
  getSocketUrl: function(endpoint) {
    return Faye.URI.parse(endpoint).toURL().replace(/^http(s?):/ig, 'ws$1:');
  },
  
  isUsable: function(endpoint, callback, scope) {
    if (!Faye.ENV.WebSocket) return callback.call(scope, false);
    
    var connected = false,
        called    = false,
        socketUrl = this.getSocketUrl(endpoint),
        socket    = new WebSocket(socketUrl);
    
    socket.onopen = function() {
      connected = true;
      socket.close();
      callback.call(scope, true);
      called = true;
      socket = null;
    };
    
    var notconnected = function() {
      if (!called && !connected) callback.call(scope, false);
      called = true;
    };
    
    socket.onclose = socket.onerror = notconnected;
    Faye.ENV.setTimeout(notconnected, this.WEBSOCKET_TIMEOUT);
  }
});

Faye.extend(Faye.Transport.WebSocket.prototype, Faye.Deferrable);
Faye.Transport.register('websocket', Faye.Transport.WebSocket);
