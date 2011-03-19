Faye.NodeHttpTransport = Faye.Class(Faye.Transport, {
  request: function(message, timeout) {
    var uri      = url.parse(this._endpoint),
        secure   = (uri.protocol === 'https:'),
        port     = (secure ? 443 : 80),
        client   = http.createClient(uri.port || port, uri.hostname, secure),
        content  = JSON.stringify(message),
        response = null,
        retry    = this.retry(message, timeout),
        self     = this;
    
    client.addListener('error', retry);
    
    client.addListener('end', function() {
      if (!response) retry();
    });
    
    var request = client.request('POST', uri.pathname, {
      'Content-Type':   'application/json',
      'Host':           uri.hostname,
      'Content-Length': content.length
    });
    
    request.addListener('response', function(stream) {
      response = stream;
      Faye.withDataFor(response, function(data) {
        try {
          self.receive(JSON.parse(data));
        } catch (e) {
          retry();
        }
      });
    });
    
    request.write(content);
    request.end();
  }
});

Faye.NodeHttpTransport.isUsable = function(endpoint, callback, scope) {
  callback.call(scope, typeof endpoint === 'string');
};

Faye.Transport.register('long-polling', Faye.NodeHttpTransport);

Faye.NodeLocalTransport = Faye.Class(Faye.Transport, {
  request: function(message, timeout) {
    this._endpoint.process(message, true, this.receive, this);
  }
});

Faye.NodeLocalTransport.isUsable = function(endpoint, callback, scope) {
  callback.call(scope, endpoint instanceof Faye.Server);
};

Faye.Transport.register('in-process', Faye.NodeLocalTransport);

