Faye.XHRTransport = Faye.Class(Faye.Transport, {
  request: function(message, callback, scope) {
    return Faye.XHR.request('post', this._endpoint, Faye.toJSON(message), function(response) {
      if (callback) callback.call(scope, JSON.parse(response.text()));
    });
  },
  
  abort: function(request) {
    request.abort();
  }
});

Faye.XHRTransport.isUsable = function(endpoint) {
  return Faye.URI.parse(endpoint).isLocal();
};

Faye.Transport.register('long-polling', Faye.XHRTransport);


Faye.JSONPTransport = Faye.extend(Faye.Class(Faye.Transport, {
  request: function(message, callback, scope) {
    var params       = {message: Faye.toJSON(message)},
        head         = document.getElementsByTagName('head')[0],
        script       = document.createElement('script'),
        callbackName = Faye.JSONPTransport.getCallbackName(),
        location     = Faye.URI.parse(this._endpoint, params);
    
    Faye.ENV[callbackName] = function(data) {
      Faye.ENV[callbackName] = undefined;
      try { delete Faye.ENV[callbackName] } catch (e) {}
      if (!script.parentNode) return;
      head.removeChild(script);
      if (callback) callback.call(scope, data);
    };
    
    location.params.jsonp = callbackName;
    script.type = 'text/javascript';
    script.src  = location.toURL();
    head.appendChild(script);
    
    return script;
  },
  
  abort: function(script) {
    if (!script.parentNode) return;
    script.parentNode.removeChild(script);
  }
}), {
  _cbCount: 0,
  
  getCallbackName: function() {
    this._cbCount += 1;
    return '__jsonp' + this._cbCount + '__';
  }
});

Faye.JSONPTransport.isUsable = function(endpoint) {
  return true;
};

Faye.Transport.register('callback-polling', Faye.JSONPTransport);

