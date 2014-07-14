Faye.Dispatcher = Faye.Class({
  MAX_REQUEST_SIZE: 2048,
  DEFAULT_RETRY:    5,

  UP:   1,
  DOWN: 2,

  initialize: function(client, endpoint, options) {
    this._client     = client;
    this.endpoint    = Faye.URI.parse(endpoint);
    this._alternates = options.endpoints || {};

    this.ca         = options.ca;
    this.cookies    = Faye.Cookies && new Faye.Cookies.CookieJar();
    this._disabled  = [];
    this._envelopes = {};
    this.headers    = {};
    this.retry      = options.retry || this.DEFAULT_RETRY;
    this._state     = 0;
    this.transports = {};

    for (var type in this._alternates)
      this._alternates[type] = Faye.URI.parse(this._alternates[type]);

    this.maxRequestSize = this.MAX_REQUEST_SIZE;
  },

  endpointFor: function(connectionType) {
    return this._alternates[connectionType] || this.endpoint;
  },

  disable: function(feature) {
    this._disabled.push(feature);
  },

  setHeader: function(name, value) {
    this.headers[name] = value;
  },

  close: function() {
    var transport = this._transport;
    delete this._transport;
    if (transport) transport.close();
  },

  selectTransport: function(transportTypes) {
    Faye.Transport.get(this, transportTypes, this._disabled, function(transport) {
      this.debug('Selected ? transport for ?', transport.connectionType, Faye.URI.stringify(transport.endpoint));

      if (transport === this._transport) return;
      if (this._transport) this._transport.close();

      this._transport = transport;
      this.connectionType = transport.connectionType;
    }, this);
  },

  sendMessage: function(message, timeout) {
    if (!this._transport) return;

    var self     = this,
        id       = message.id,
        envelope = this._envelopes[id] = this._envelopes[id] ||
                   {message: message, timeout: timeout, request: null, timer: null};

    if (envelope.request || envelope.timer) return;

    envelope.timer = Faye.ENV.setTimeout(function() {
      self.handleError(message);
    }, timeout * 1000);

    envelope.request = this._transport.sendMessage(message);
  },

  handleResponse: function(reply) {
    var envelope = this._envelopes[reply.id];

    if (reply.successful !== undefined && envelope) {
      delete this._envelopes[reply.id];
      Faye.ENV.clearTimeout(envelope.timer);
    }

    this.trigger('message', reply);

    if (this._state === this.UP) return;
    this._state = this.UP;
    this._client.trigger('transport:up');
  },

  handleError: function(message, immediate) {
    var envelope = this._envelopes[message.id],
        request  = envelope && envelope.request,
        self     = this;

    if (!envelope || !envelope.request) return;

    request.then(function(req) {
      if (req && req.abort) req.abort();
    });

    Faye.ENV.clearTimeout(envelope.timer);
    envelope.request = envelope.timer = null;

    if (immediate) {
      this.sendMessage(envelope.message, envelope.timeout);
    } else {
      envelope.timer = Faye.ENV.setTimeout(function() {
        envelope.timer = null;
        self.sendMessage(envelope.message, envelope.timeout);
      }, this.retry * 1000);
    }

    if (this._state === this.DOWN) return;
    this._state = this.DOWN;
    this._client.trigger('transport:down');
  }
});

Faye.extend(Faye.Dispatcher.prototype, Faye.Publisher);
Faye.extend(Faye.Dispatcher.prototype, Faye.Logging);
