Faye.Transport.NodeHttp = Faye.extend(Faye.Class(Faye.Transport, {
  initialize: function() {
    Faye.Transport.prototype.initialize.apply(this, arguments);

    this._endpointSecure = (this.SECURE_PROTOCOLS.indexOf(this.endpoint.protocol) >= 0);
    this._httpClient     = this._endpointSecure ? https : http;

    var proxy = this._proxy;
    if (!proxy.origin) return;

    this._proxyUri    = url.parse(proxy.origin);
    this._proxySecure = (this.SECURE_PROTOCOLS.indexOf(this._proxyUri.protocol) >= 0);

    if (!this._endpointSecure) {
      this._httpClient = this._proxySecure ? https : http;
      return;
    }

    var options = Faye.extend({
      proxy: {
        host:       this._proxyUri.hostname,
        port:       this._proxyUri.port || this.DEFAULT_PORTS[this._proxyUri.protocol],
        proxyAuth:  this._proxyUri.auth,
        headers:    Faye.extend({host: this.endpoint.host}, proxy.headers)
      }
    }, this._dispatcher.tls);

    if (this._proxySecure) {
      Faye.extend(options.proxy, proxy.tls);
      this._tunnel = tunnel.httpsOverHttps(options);
    } else {
      this._tunnel = tunnel.httpsOverHttp(options);
    }
  },

  encode: function(messages) {
    return Faye.toJSON(messages);
  },

  request: function(messages) {
    var content = new Buffer(this.encode(messages), 'utf8'),
        params  = this._buildParams(content),
        request = this._httpClient.request(params),
        self    = this;

    request.on('response', function(response) {
      self._handleResponse(messages, response);
      self._storeCookies(response.headers['set-cookie']);
    });

    request.on('error', function(error) {
      self._handleError(messages);
    });

    request.end(content);
    return request;
  },

  _buildParams: function(content) {
    var uri    = this.endpoint,
        proxy  = this._proxyUri,
        target = this._tunnel ? uri : (proxy || uri);

    var params = {
      method:   'POST',
      host:     target.hostname,
      port:     target.port || this.DEFAULT_PORTS[target.protocol],
      path:     uri.path,
      headers:  Faye.extend({
        'Content-Length': content.length,
        'Content-Type':   'application/json',
        'Host':           uri.host
      }, this._dispatcher.headers)
    };

    var cookie = this._getCookies();
    if (cookie !== '') params.headers['Cookie'] = cookie;

    if (this._tunnel) {
      params.agent = this._tunnel;
    } else if (this._endpointSecure) {
      Faye.extend(params, this._dispatcher.tls);
    } else if (proxy) {
      params.path = this.endpoint.href;
      Faye.extend(params, this._proxy.tls);
      if (proxy.auth)
        params.headers['Proxy-Authorization'] = new Buffer(proxy.auth, 'utf8').toString('base64');
    }

    return params;
  },

  _handleResponse: function(messages, response) {
    var replies = null,
        body    = '',
        self    = this;

    response.setEncoding('utf8');
    response.on('data', function(chunk) { body += chunk });

    response.on('end', function() {
      try {
        replies = JSON.parse(body);
      } catch (e) {}

      if (replies)
        self._receive(replies);
      else
        self._handleError(messages);
    });
  }

}), {
  isUsable: function(dispatcher, endpoint, callback, context) {
    callback.call(context, Faye.URI.isURI(endpoint));
  }
});

Faye.Transport.register('long-polling', Faye.Transport.NodeHttp);
