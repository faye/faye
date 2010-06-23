Faye.NodeHttpTransport = Faye.Class(Faye.Transport, {
  request: function(message, timeout) {
    var timeout = timeout || this._client.getTimeout(),
        request = this.createRequestForMessage(message, timeout),
        self    = this;
    
    request.addListener('response', function(response) {
      Faye.withDataFor(response, function(data) {
        self.receive(JSON.parse(data));
      });
    });
    request.end();
    
    return request;
  },
  
  createRequestForMessage: function(message, timeout) {
    var content = JSON.stringify(message),
        uri     = url.parse(this._endpoint),
        client  = http.createClient(uri.port, uri.hostname),
        self    = this;
    
    var retry = function() {
      self.request(message, 2 * timeout);
    };
    
    client.addListener('error', function() { setTimeout(retry, timeout) });
    
    if (parseInt(uri.port) === 443) client.setSecure('X509_PEM');
    
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
  request: function(message) {
    this._endpoint.process(message, true, this.receive, this);
    return true;
  }
});

Faye.NodeLocalTransport.isUsable = function(endpoint) {
  return endpoint instanceof Faye.Server;
};

Faye.Transport.register('in-process', Faye.NodeLocalTransport);

