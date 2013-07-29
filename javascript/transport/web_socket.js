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

  request: function(messages, timeout) {
    if (messages.length === 0) return;
    this._messages = this._messages || {};

    for (var i = 0, n = messages.length; i < n; i++) {
      this._messages[messages[i].id] = messages[i];
    }
    this.callback(function(socket) {
      if (socket) socket.send(Faye.toJSON(messages));
    });
    this.connect();
  },

  close: function() {
    if (!this._socket) return;
    this._socket.onclose = this._socket.onerror = null;
    this.removeTimeout('ping');
    this._socket.close();
    delete this._socket;
    this.setDeferredStatus('deferred');
    this._state = this.UNCONNECTED;
  },

  connect: function() {
    if (Faye.Transport.WebSocket._unloaded) return;

    this._state = this._state || this.UNCONNECTED;
    if (this._state !== this.UNCONNECTED) return;

    this._state = this.CONNECTING;

    var ws = Faye.Transport.WebSocket.getClass();
    if (!ws) return this.setDeferredStatus('failed');

    var url     = Faye.Transport.WebSocket.getSocketUrl(this.endpoint),
        options = {headers: this._client.headers, ca: this._client.ca};

    this._socket = Faye.WebSocket ? new ws(url, [], options) : new ws(url);

    var self = this;

    this._socket.onopen = function() {
      self._state = self.CONNECTED;
      self._everConnected = true;
      self._ping();
      self.setDeferredStatus('succeeded', self._socket);
      self.trigger('up');
    };

    this._socket.onmessage = function(event) {
      var messages = JSON.parse(event.data);
      if (!messages) return;
      messages = [].concat(messages);

      for (var i = 0, n = messages.length; i < n; i++) {
        delete self._messages[messages[i].id];
      }
      self.receive(messages);
    };

    this._socket.onclose = this._socket.onerror = function() {
      var wasConnected = (self._state === self.CONNECTED);
      self.setDeferredStatus('deferred');
      self._state = self.UNCONNECTED;

      self.close();

      if (wasConnected) return self.resend();
      if (!self._everConnected) return self.setDeferredStatus('failed');

      var retry = self._client.retry * 1000;
      Faye.ENV.setTimeout(function() { self.connect() }, retry);
      self.trigger('down');
    };
  },

  resend: function() {
    if (!this._messages) return;
    var messages = Faye.map(this._messages, function(id, msg) { return msg });
    this.request(messages);
  },

  _ping: function() {
    this._socket.send('[]');
    this.addTimeout('ping', this._client._advice.timeout/2000, this._ping, this);
  }
}), {
  PROTOCOLS: {
    'http:':  'ws:',
    'https:': 'wss:'
  },

  getSocketUrl: function(endpoint) {
    endpoint = Faye.copyObject(endpoint);
    endpoint.protocol = this.PROTOCOLS[endpoint.protocol];
    return Faye.URI.stringify(endpoint);
  },

  getClass: function() {
    return (Faye.WebSocket && Faye.WebSocket.Client) ||
            Faye.ENV.WebSocket ||
            Faye.ENV.MozWebSocket;
  },

  isUsable: function(client, endpoint, callback, context) {
    this.create(client, endpoint).isUsable(callback, context);
  },

  create: function(client, endpoint) {
    var sockets = client.transports.websocket = client.transports.websocket || {};
    sockets[endpoint.href] = sockets[endpoint.href] || new this(client, endpoint);
    return sockets[endpoint.href];
  }
});

Faye.extend(Faye.Transport.WebSocket.prototype, Faye.Deferrable);
Faye.Transport.register('websocket', Faye.Transport.WebSocket);

if (Faye.Event)
  Faye.Event.on(Faye.ENV, 'beforeunload', function() {
    Faye.Transport.WebSocket._unloaded = true;
  });

