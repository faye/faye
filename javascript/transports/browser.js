// http://assanka.net/content/tech/2009/09/02/json2-js-vs-prototype/
Faye.Transport.toJSON = function(key, value) {
  return (this[key] instanceof Array)
      ? this[key]
      : value;
};

Faye.XHRTransport = Faye.Class(Faye.Transport, {
  request: function(message, callback, scope) {
    var params = {message: Faye.stringify(message, Faye.Transport.toJSON)};
    Faye.XHR.request('post', this._endpoint, params, function(response) {
      if (callback) callback.call(scope, JSON.parse(response.text()));
    });
  }
});

Faye.XHRTransport.isUsable = function(endpoint) {
  return Faye.URI.parse(endpoint).isLocal();
};

Faye.Transport.register('long-polling', Faye.XHRTransport);


Faye.JSONPTransport = Faye.extend(Faye.Class(Faye.Transport, {
  request: function(message, callback, scope) {
    var params       = {message: Faye.stringify(message, Faye.Transport.toJSON)},
        head         = document.getElementsByTagName('head')[0],
        script       = document.createElement('script'),
        callbackName = Faye.JSONPTransport.getCallbackName(),
        location     = Faye.URI.parse(this._endpoint, params);
    
    Faye.ENV[callbackName] = function(data) {
      Faye.ENV[callbackName] = undefined;
      try { delete Faye.ENV[callbackName] } catch (e) {}
      head.removeChild(script);
      if (callback) callback.call(scope, data);
    };
    
    location.params.jsonp = callbackName;
    script.type = 'text/javascript';
    script.src  = location.toURL();
    head.appendChild(script);
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

