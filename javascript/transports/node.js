Faye.NodeHttpTransport = Faye.Class(Faye.Transport, {
  request: function(message, callback, scope) {
    var request = this.createRequestForMessage(message);
    
    request.addListener('response', function(response) {
      if (!callback) return;
      Faye.withDataFor(response, function(data) {
        callback.call(scope, JSON.parse(data));
      });
    });
    request.end();
  },
  
  createRequestForMessage: function(message) {
    var content = JSON.stringify(message),
        uri     = url.parse(this._endpoint),
        client  = http.createClient(uri.port, uri.hostname);
    
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
  request: function(message, callback, scope) {
    this._endpoint.process(message, true, function(response) {
      callback.call(scope, response);
    });
  }
});

Faye.NodeLocalTransport.isUsable = function(endpoint) {
  return endpoint instanceof Faye.Server;
};

Faye.Transport.register('in-process', Faye.NodeLocalTransport);

