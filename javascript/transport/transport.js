Faye.Transport = Faye.extend(Faye.Class({
  MAX_DELAY: 0,
  batching:  true,

  initialize: function(client, endpoint) {
    this._client  = client;
    this.endpoint = endpoint;
    this._outbox  = [];
  },

  close: function() {},

  send: function(message, timeout) {
    this.debug('Client ? sending message to ?: ?',
               this._client._clientId, Faye.URI.stringify(this.endpoint), message);

    if (!this.batching) return this.request([message], timeout);

    this._outbox.push(message);
    this._timeout = timeout;

    if (message.channel === Faye.Channel.HANDSHAKE)
      return this.addTimeout('publish', 0.01, this.flush, this);

    if (message.channel === Faye.Channel.CONNECT)
      this._connectMessage = message;

    if (this.shouldFlush && this.shouldFlush(this._outbox))
      return this.flush();

    this.addTimeout('publish', this.MAX_DELAY, this.flush, this);
  },

  flush: function() {
    this.removeTimeout('publish');

    if (this._outbox.length > 1 && this._connectMessage)
      this._connectMessage.advice = {timeout: 0};

    this.request(this._outbox, this._timeout);

    this._connectMessage = null;
    this._outbox = [];
  },

  receive: function(responses) {
    this.debug('Client ? received from ?: ?',
               this._client._clientId, Faye.URI.stringify(this.endpoint), responses);

    for (var i = 0, n = responses.length; i < n; i++) {
      this._client.receiveMessage(responses[i]);
    }
  },

  retry: function(message, timeout) {
    var called = false,
        retry  = this._client.retry * 1000,
        self   = this;

    return function() {
      if (called) return;
      called = true;
      Faye.ENV.setTimeout(function() { self.request(message, timeout) }, retry);
    };
  }

}), {
  MAX_URL_LENGTH: 2048,

  get: function(client, allowed, disabled, callback, context) {
    var endpoint = client.endpoint;

    Faye.asyncEach(this._transports, function(pair, resume) {
      var connType     = pair[0], klass = pair[1],
          connEndpoint = client.endpoints[connType] || endpoint;

      if (Faye.indexOf(disabled, connType) >= 0)
        return resume();

      if (Faye.indexOf(allowed, connType) < 0) {
        klass.isUsable(client, connEndpoint, function() {});
        return resume();
      }

      klass.isUsable(client, connEndpoint, function(isUsable) {
        if (!isUsable) return resume();
        var transport = klass.hasOwnProperty('create') ? klass.create(client, connEndpoint) : new klass(client, connEndpoint);
        callback.call(context, transport);
      });
    }, function() {
      throw new Error('Could not find a usable connection type for ' + Faye.URI.stringify(endpoint));
    });
  },

  register: function(type, klass) {
    this._transports.push([type, klass]);
    klass.prototype.connectionType = type;
  },

  _transports: []
});

Faye.extend(Faye.Transport.prototype, Faye.Logging);
Faye.extend(Faye.Transport.prototype, Faye.Publisher);
Faye.extend(Faye.Transport.prototype, Faye.Timeouts);

