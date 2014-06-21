Faye.Transport.NodeHttp = Faye.extend(Faye.Class(Faye.Transport, {
  encode: function(messages) {
    return Faye.toJSON(messages);
  },

  request: function(messages) {
    var uri     = this.endpoint,
        secure  = (uri.protocol === 'https:'),
        client  = secure ? https : http,
        content = new Buffer(this.encode(messages), 'utf8'),
        self    = this;

    var params  = this._buildParams(uri, content, secure),
        request = client.request(params);

    request.on('response', function(response) {
      self._handleResponse(messages, response);
      self._storeCookies(response.headers['set-cookie']);
    });

    request.on('error', function(error) {
      self._handleError(messages);
    });

    request.end(content);
  },

  _buildParams: function(uri, content, secure) {
    var params = {
      method:   'POST',
      host:     uri.hostname,
      port:     uri.port || (secure ? 443 : 80),
      path:     uri.path,
      headers:  Faye.extend({
        'Content-Length': content.length,
        'Content-Type':   'application/json',
        'Cookie':         this._getCookies(),
        'Host':           uri.host
      }, this._dispatcher.headers)
    };
    if (this._dispatcher.ca) params.ca = this._dispatcher.ca;
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
