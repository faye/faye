Faye.Transport.EventSource = Faye.extend(Faye.Class(Faye.Transport, {
  initialize: function(client, endpoint) {
    Faye.Transport.prototype.initialize.call(this, client, endpoint);
    if (!Faye.ENV.EventSource) return this.setDeferredStatus('failed');

    this._xhr = new Faye.Transport.XHR(client, endpoint);

    var socket = new EventSource(endpoint + '/' + client.getClientId()),
        self   = this;

    socket.onopen = function() {
      self._everConnected = true;
      self.setDeferredStatus('succeeded');
      self.trigger('up');
    };

    socket.onerror = function() {
      if (self._everConnected) {
        self.trigger('down');
      } else {
        self.setDeferredStatus('failed');
        socket.close();
      }
    };

    socket.onmessage = function(event) {
      self.receive(JSON.parse(event.data));
      self.trigger('up');
    };

    this._socket = socket;
  },

  isUsable: function(callback, context) {
    this.callback(function() { callback.call(context, true) });
    this.errback(function() { callback.call(context, false) });
  },

  request: function(message, timeout) {
    this._xhr.request(message, timeout);
  },

  close: function() {
    if (!this._socket) return;
    this._socket.onerror = null;
    this._socket.close();
    delete this._socket;
  }
}), {
  isUsable: function(client, endpoint, callback, context) {
    var id = client.getClientId();
    if (!id) return callback.call(context, false);

    Faye.Transport.XHR.isUsable(client, endpoint, function(usable) {
      if (!usable) return callback.call(context, false);
      this.create(client, endpoint).isUsable(callback, context);
    }, this);
  },

  create: function(client, endpoint) {
    var sockets  = client.transports.eventsource = client.transports.eventsource || {},
        id       = client.getClientId(),
        endpoint = endpoint + '/' + (id || '');

    sockets[endpoint] = sockets[endpoint] || new this(client, endpoint);
    return sockets[endpoint];
  }
});

Faye.extend(Faye.Transport.EventSource.prototype, Faye.Deferrable);
Faye.Transport.register('eventsource', Faye.Transport.EventSource);

