Faye.Transport = Faye.extend(Faye.Class({
  initialize: function(client, endpoint) {
    this._client   = client;
    this._endpoint = endpoint;
  },
  
  send: function(message, callback, scope) {
    message = {message: JSON.stringify(message)};
    return this.request(message, function(responses) {
      if (!callback) return;
      Faye.each([].concat(responses), function(response) {
        
        callback.call(scope, response);
        
        if (response.advice)
          this._client._handleAdvice(response.advice);
        
        if (response.data && response.channel)
          this._client._sendToSubscribers(response);
        
      }, this);
    }, this);
  }
}), {
  get: function(client, connectionTypes) {
    var endpoint = client._endpoint;
    if (connectionTypes === undefined) connectionTypes = this.supportedConnectionTypes();
    
    var candidateClass = null;
    Faye.each(this._transports, function(connType, klass) {
      if (candidateClass) return;
      if (klass.isUsable(endpoint)) candidateClass = klass;
    });
    
    if (!candidateClass) throw 'Could not find a usable connection type for ' + endpoint;
    
    return new candidateClass(client, endpoint);
  },
  
  register: function(type, klass) {
    this._transports[type] = klass;
    klass.prototype.connectionType = type;
  },
  
  _transports: {},
  
  supportedConnectionTypes: function() {
    var list = [], key;
    Faye.each(this._transports, function(key, type) { list.push(key) });
    return list;
  }
});

