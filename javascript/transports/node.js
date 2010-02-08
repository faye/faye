Faye.NodeTransport = Faye.Class(Faye.Transport, {
  request: function(message, callback, scope) {
    var params  = {message: JSON.stringify(message)},
        request = this.createRequest();
    
    request.sendBody(querystring.stringify(params));
    
    request.finish(function(response) {
      if (!callback) return;
      response.addListener('body', function(chunk) {
        callback.call(scope, JSON.parse(chunk));
      });
    });
  },
  
  createRequest: function() {
    var uri    = url.parse(this._endpoint),
        client = http.createClient(uri.port, uri.hostname);
        
    return client.request('POST', uri.pathname, {
      'Content-Type': 'application/x-www-form-urlencoded'
    });
  }
});

Faye.NodeTransport.isUsable = function() { return true };

Faye.Transport.register('long-polling', Faye.NodeTransport);

