var CookieJar = require('cookiejar').CookieJar;

Faye.Transport.NodeHttp = Faye.extend(Faye.Class(Faye.Transport, {
  request: function(message, timeout) {
    var uri      = url.parse(this._endpoint),
        secure   = (uri.protocol === 'https:'),
        client   = secure ? https : http,
        port     = uri.port || (secure ? 443 : 80),
        content  = new Buffer(JSON.stringify(message)),
        response = null,
        body     = '',
        retry    = this.retry(message, timeout),
        self     = this;
    
    this._client.cookies = this._client.cookies || new CookieJar();
    var cookies = this._client.cookies.getCookies({domain: uri.hostname, path: uri.pathname});
    
    var request = client.request({
      method:   'POST',
      host:     uri.hostname,
      port:     port,
      path:     uri.pathname,
      headers:  {
        'Content-Length': content.length,
        'Content-Type':   'application/json',
        'Cookie':         cookies.toValueString(),
        'Host':           uri.hostname
      }
    });
    
    request.addListener('response', function(stream) {
      response = stream;
      
      var cookies = response.headers['set-cookie'], cookie;
      if (cookies) {
        for (var i = 0, n = cookies.length; i < n; i++) {
          cookie = self._client.cookies.setCookie(cookies[i]);
          cookie = cookie[0] || cookie;
          cookie.domain = cookie.domain || uri.hostname;
        }
      }
      
      response.addListener('data', function(c) { body += c.toString('utf8', 0, c.length) });
      response.addListener('end', function() {
        try {
          self.receive(JSON.parse(body));
        } catch (e) {
          retry();
        }
      });
    });
    
    request.addListener('error', retry);
    request.write(content);
    request.end();
  }
}), {
  isUsable: function(endpoint, callback, scope) {
    callback.call(scope, typeof endpoint === 'string');
  }
});

Faye.Transport.register('long-polling', Faye.Transport.NodeHttp);
