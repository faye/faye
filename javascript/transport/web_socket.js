Faye.Transport.WebSocket = Faye.extend(Faye.Class(Faye.Transport, {
  UNCONNECTED:  1,
  CONNECTING:   2,
  CONNECTED:    3,

  batching:     false,

  isUsable: function(callback, context) {
    this.callback(function() { callback.call(context, true) });
    this.errback(function() { callback.call(context, false) });
    this.connect();
  },

  request: function(messages) {
    this._pending = this._pending || new Faye.Set();
    for (var i = 0, n = messages.length; i < n; i++) this._pending.add(messages[i]);

    var promise = new Faye.Promise();

    this.callback(function(socket) {
      if (!socket) return;
      socket.send(Faye.toJSON(messages));
      Faye.Promise.fulfill(promise, socket);
    }, this);

    this.connect();

    return {
      abort: function() { promise.then(function(ws) { ws.close() }) }
    };
  },

  connect: function() {
    if (Faye.Transport.WebSocket._unloaded) return;

    this._state = this._state || this.UNCONNECTED;
    if (this._state !== this.UNCONNECTED) return;
    this._state = this.CONNECTING;

    var socket = this._createSocket();
    if (!socket) return this.setDeferredStatus('failed');

    var self = this;

    socket.onopen = function() {
      if (socket.headers) self._storeCookies(socket.headers['set-cookie']);
      self._socket = socket;
      self._state = self.CONNECTED;
      self._everConnected = true;
      self._ping();
      self.setDeferredStatus('succeeded', socket);
    };

    var closed = false;
    socket.onclose = socket.onerror = function() {
      if (closed) return;
      closed = true;

      var wasConnected = (self._state === self.CONNECTED);
      socket.onopen = socket.onclose = socket.onerror = socket.onmessage = null;

      delete self._socket;
      self._state = self.UNCONNECTED;
      self.removeTimeout('ping');
      self.setDeferredStatus('unknown');

      var pending = self._pending ? self._pending.toArray() : [];
      delete self._pending;

      if (wasConnected) {
        self._handleError(pending, true);
      } else if (self._everConnected) {
        self._handleError(pending);
      } else {
        self.setDeferredStatus('failed');
      }
    };

    socket.onmessage = function(event) {
      var replies = JSON.parse(event.data);
      if (!replies) return;

      replies = [].concat(replies);

      for (var i = 0, n = replies.length; i < n; i++) {
        if (replies[i].successful === undefined) continue;
        self._pending.remove(replies[i]);
      }
      self._receive(replies);
    };
  },

  close: function() {
    if (!this._socket) return;
    this._socket.close();
  },

  _createSocket: function() {
    var url     = Faye.Transport.WebSocket.getSocketUrl(this.endpoint),
        cookie  = this._getCookies(),
        headers = this._dispatcher.headers,
        tls     = this._dispatcher.tls,
        options = {headers: headers, proxy: this._proxy, tls: tls};

    if (cookie !== '') options.headers['Cookie'] = cookie;

    if (Faye.WebSocket)        return new Faye.WebSocket.Client(url, [], options);
    if (Faye.ENV.MozWebSocket) return new MozWebSocket(url);
    if (Faye.ENV.WebSocket)    return new WebSocket(url);
  },

  _ping: function() {
    if (!this._socket) return;
    this._socket.send('[]');
    this.addTimeout('ping', this._dispatcher.timeout / 2, this._ping, this);
  }

}), {
  PROTOCOLS: {
    'http:':  'ws:',
    'https:': 'wss:'
  },

  create: function(dispatcher, endpoint) {
    var sockets = dispatcher.transports.websocket = dispatcher.transports.websocket || {};
    sockets[endpoint.href] = sockets[endpoint.href] || new this(dispatcher, endpoint);
    return sockets[endpoint.href];
  },

  getSocketUrl: function(endpoint) {
    endpoint = Faye.copyObject(endpoint);
    endpoint.protocol = this.PROTOCOLS[endpoint.protocol];
    return Faye.URI.stringify(endpoint);
  },

  isUsable: function(dispatcher, endpoint, callback, context) {
    this.create(dispatcher, endpoint).isUsable(callback, context);
  }
});

Faye.extend(Faye.Transport.WebSocket.prototype, Faye.Deferrable);
Faye.Transport.register('websocket', Faye.Transport.WebSocket);

if (Faye.Event && Faye.ENV.onbeforeunload !== undefined)
  Faye.Event.on(Faye.ENV, 'beforeunload', function() {
    Faye.Transport.WebSocket._unloaded = true;
  });
