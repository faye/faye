Faye.NodeHttpTransport = Faye.Class(Faye.Transport, {
  request: function(message, callback, scope) {
    var content = JSON.stringify(message);
    var request = this.createRequestForContent(content);

    request.write(content);
    
    request.addListener('response', function(response) {
      if (!callback) return;
      Faye.withDataFor(response, function(data) {
        callback.call(scope, JSON.parse(data));
      });
    });
    request.close();
  },
  
  createRequestForContent: function(content) {
    var uri    = url.parse(this._endpoint),
        client = http.createClient(uri.port, uri.hostname);

    if (parseInt(uri.port) == 443) {
        client.setSecure("x509_PEM");
    }
    
    return client.request('POST', uri.pathname, {
      'Content-Type': 'application/json',
      'host': uri.hostname,
      'Content-Length': content.length
    });
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

