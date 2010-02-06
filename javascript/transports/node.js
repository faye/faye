Faye.NodeTransport = Faye.Class(Faye.Transport, {
  request: function(params, callback, scope) {
    var uri     = url.parse(this._endpoint),
        client  = http.createClient(uri.port, uri.hostname),
        
        request = client.request('POST', uri.pathname, {
                  'Content-Type': 'application/x-www-form-urlencoded'
                  });
    
    var pairs = [];
    Faye.each(params, function(key, value) {
      pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    });
    request.sendBody(pairs.join('&'));
    
    request.finish(function(response) {
      if (!callback) return;
      response.addListener('body', function(chunk) {
        callback.call(scope, JSON.parse(chunk));
      });
    });
  }
});

Faye.NodeTransport.isUsable = function() { return true };

Faye.Transport.register('long-polling', Faye.NodeTransport);

