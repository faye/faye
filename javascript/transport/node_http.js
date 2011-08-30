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
    
    var request = client.request({
      method:   'POST',
      host:     uri.hostname,
      port:     port,
      path:     uri.pathname,
      headers:  {
        'Content-Type':   'application/json',
        'Host':           uri.hostname,
        'Content-Length': content.length
      }
    });
    
    request.addListener('response', function(stream) {
      response = stream;
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
