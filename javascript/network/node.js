Faye.NodeHttpTransport = Faye.Class(Faye.Transport, {
  request: function(message, timeout) {
    var retry   = this.retry(message, timeout),
        request = this.createRequestForMessage(message, retry),
        self    = this;
    
    request.addListener('response', function(response) {
      Faye.withDataFor(response, function(data) {
        try {
          self.receive(JSON.parse(data));
        } catch (e) {
          retry();
        }
      });
    });
    request.end();
  },
  
  createRequestForMessage: function(message, retry) {
    var content = JSON.stringify(message),
        uri     = url.parse(this._endpoint),
        client  = http.createClient(uri.port, uri.hostname, uri.protocol === 'https:');
    
    client.addListener('error', retry);
    
    var request = client.request('POST', uri.pathname, {
      'Content-Type':   'application/json',
      'host':           uri.hostname,
      'Content-Length': content.length
    });
    request.write(content);
    return request;
  }
});

Faye.NodeHttpTransport.isUsable = function(endpoint) {
  return typeof endpoint === 'string';
};

Faye.Transport.register('long-polling', Faye.NodeHttpTransport);

Faye.NodeLocalTransport = Faye.Class(Faye.Transport, {
  request: function(message, timeout) {
    this._endpoint.process(message, true, this.receive, this);
  }
});

Faye.NodeLocalTransport.isUsable = function(endpoint) {
  return endpoint instanceof Faye.Server;
};

Faye.Transport.register('in-process', Faye.NodeLocalTransport);

