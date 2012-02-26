Faye.Transport.NodeHttp = Faye.extend(Faye.Class(Faye.Transport, {
  request: function(message, timeout) {
    var uri      = url.parse(this._endpoint),
        secure   = (uri.protocol === 'https:'),
        client   = secure ? https : http,
        content  = new Buffer(JSON.stringify(message), 'utf8'),
        retry    = this.retry(message, timeout),
        self     = this;
    
    var cookies = this.cookies.getCookies({domain: uri.hostname, path: uri.pathname}),
        params  = this._buildParams(uri, content, cookies, secure),
        request = client.request(params);
    
    request.addListener('response', function(response) {
      self._handleResponse(response, retry);
      self._storeCookies(uri.hostname, response.headers['set-cookie']);
    });
    
    request.addListener('error', function() {
      retry();
      self.trigger('down');
    });
    request.write(content);
    request.end();
  },
  
  _buildParams: function(uri, content, cookies, secure) {
    return {
      method:   'POST',
      host:     uri.hostname,
      port:     uri.port || (secure ? 443 : 80),
      path:     uri.pathname,
      headers:  Faye.extend({
        'Content-Length': content.length,
        'Content-Type':   'application/json',
        'Cookie':         cookies.toValueString(),
        'Host':           uri.hostname
      }, this.headers)
    };
  },
  
  _handleResponse: function(response, retry) {
    var message = null,
        body    = '',
        self    = this;
    
    response.addListener('data', function(c) { body += c.toString('utf8', 0, c.length) });
    response.addListener('end', function() {
      try {
        message = JSON.parse(body);
      } catch (e) {}
      
      if (message) {
        self.receive(message);
        self.trigger('up');
      } else {
        retry();
        self.trigger('down');
      }
    });
  },
  
  _storeCookies: function(hostname, cookies) {
    if (!cookies) return;
    var cookie;
    
    for (var i = 0, n = cookies.length; i < n; i++) {
      cookie = this.cookies.setCookie(cookies[i]);
      cookie = cookie[0] || cookie;
      cookie.domain = cookie.domain || hostname;
    }
  }
  
}), {
  isUsable: function(endpoint, callback, context) {
    callback.call(context, typeof endpoint === 'string');
  }
});

Faye.Transport.register('long-polling', Faye.Transport.NodeHttp);
