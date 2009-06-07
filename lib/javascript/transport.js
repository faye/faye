Faye.Transport = Faye.extend(Faye.Class({
  initialize: function(endpoint) {
    this._endpoint = endpoint;
  },
  
  send: function(message, callback, scope) {
    message = {message: JSON.stringify(message)};
    return this.request(message, function(responses) {
      if (!callback) return;
      if (!(responses instanceof Array)) responses = [responses];
      for (var i = 0, n = responses.length; i < n; i++)
        callback.call(scope, responses[i]);
    });
  },
  
  hang: function() {
    this.request({message: 'hang'});
  },
  
  handshake: function(callback, scope) {
    this.send({
      channel: Faye.Channel.HANDSHAKE,
      version: Faye.BAYEUX_VERSION,
      supportedConnectionTypes: ['long-polling']
    }, function(message) {
      if (callback) callback.call(scope, message.clientId);
    });
  },
  
  connect: function(id, callback, scope) {
    this.send({
      channel: Faye.Channel.CONNECT,
      clientId: id,
      connectionType: 'long-polling'
    }, function(message) {
      if (callback) callback.call(scope, message);
    }, this);
  },
  
  disconnect: function(id, callback, scope) {
    this.send({
      channel: Faye.Channel.DISCONNECT,
      clientId: id
    });
  }
}), {
  get: function(endpoint) {
  //  return new Faye.JSONPTransport(endpoint);
    var klass = Faye.URI.parse(endpoint).isLocal()
        ? Faye.XHRTransport
        : Faye.JSONPTransport;
    return new klass(endpoint);
  }
});

Faye.XHRTransport = Faye.Class(Faye.Transport, {
  request: function(params, callback, scope) {
    Faye.XHR.request('post', this._endpoint, params, function(response) {
      if (callback) callback.call(scope, JSON.parse(response.text()));
    });
  }
});

Faye.JSONPTransport = Faye.extend(Faye.Class(Faye.Transport, {
  request: function(params, callback, scope) {
    var head     = document.getElementsByTagName('head')[0],
        script   = document.createElement('script'),
        location = Faye.URI.parse(this._endpoint, params);
    
    var callbackParam = location.params.jsonp || 'jsonp',
        callbackName  = Faye.JSONPTransport.getCallbackName();
    
    Faye.ENV[callbackName] = function(data) {
      Faye.ENV[callbackName] = undefined;
      try { delete Faye.ENV[callbackName] } catch (e) {}
      head.removeChild(script);
      if (callback) callback.call(scope, data);
    };
    
    delete location.params.jsonp;
    location.params[callbackParam] = callbackName;
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

