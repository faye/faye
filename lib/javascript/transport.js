Faye.Transport = Faye.extend(Faye.Class({
  initialize: function(endpoint) {
    this._endpoint = endpoint;
  },
  
  send: function(message, callback, scope) {
    message = {message: JSON.stringify(message)};
    return this.request(message, function(responses) {
      if (!callback) return;
      responses = [].concat(responses);
      for (var i = 0, n = responses.length; i < n; i++)
        callback.call(scope, responses[i]);
    });
  },
  
  handshake: function(callback, scope) {
    this.send({
      channel: Faye.Channel.HANDSHAKE,
      version: Faye.BAYEUX_VERSION,
      supportedConnectionTypes: Faye.Transport.supportedConnectionTypes();
    }, function(message) {
      if (callback) callback.call(scope, message);
    });
  },
  
  connect: function(id, callback, scope) {
    this.send({
      channel: Faye.Channel.CONNECT,
      clientId: id,
      connectionType: this.connectionType
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
  get: function(endpoint, connectionTypes) {
    if (connectionTypes === undefined) connectionTypes = this.supportedConnectionTypes();
    
    var types = Faye.URI.parse(endpoint).isLocal()
        ? ['long-polling', 'callback-polling']
        : ['callback-polling'];
    
    var type = Faye.commonElement(types, connectionTypes);
    if (!type) throw 'Could not find a usable connection type for ' + endpoint;
    
    var klass = this._connectionTypes[type];
    return new klass(endpoint);
  },
  
  register: function(type, klass) {
    this._connectionTypes[type] = klass;
    klass.prototype.connectionType = type;
  },
  
  _connectionTypes: {},
  
  supportedConnectionTypes: function() {
    var list = [], key;
    for (key in this._connectionTypes) {
      if (this._connectionTypes.hasOwnProperty(key)) list.push(key);
    }
    return list;
  }
});

Faye.XHRTransport = Faye.Class(Faye.Transport, {
  request: function(params, callback, scope) {
    Faye.XHR.request('post', this._endpoint, params, function(response) {
      if (callback) callback.call(scope, JSON.parse(response.text()));
    });
  }
});
Faye.Transport.register('long-polling', Faye.XHRTransport);

Faye.JSONPTransport = Faye.extend(Faye.Class(Faye.Transport, {
  request: function(params, callback, scope) {
    var head         = document.getElementsByTagName('head')[0],
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
Faye.Transport.register('callback-polling', Faye.JSONPTransport);

