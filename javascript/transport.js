Faye.Transport = Faye.extend(Faye.Class({
  initialize: function(client, endpoint) {
    this.debug('Created new transport for ?', endpoint);
    this._client   = client;
    this._endpoint = endpoint;
  },
  
  send: function(message, callback, scope) {
    if (!(message instanceof Array) && !message.id)
      message.id = this._client._namespace.generate();
    
    this.debug('Client ? sending message to ?: ?',
               this._client._clientId, this._endpoint, message);
    
    this.request(message, function(responses) {
      this.debug('Client ? received from ?: ?',
                 this._client._clientId, this._endpoint, responses);
      
      if (!callback) return;
      
      var messages = [], deliverable = true;
      Faye.each([].concat(responses), function(response) {
    
        if (response.id === message.id) {
          if (callback.call(scope, response) === false)
            deliverable = false;
        }
        
        if (response.advice)
          this._client.handleAdvice(response.advice);
        
        if (response.data && response.channel)
          messages.push(response);
        
      }, this);
      
      if (deliverable) this._client.deliverMessages(messages);
    }, this);
  }
}), {
  get: function(client, connectionTypes) {
    var endpoint = client._endpoint;
    if (connectionTypes === undefined) connectionTypes = this.supportedConnectionTypes();
    
    var candidateClass = null;
    Faye.each(this._transports, function(connType, klass) {
      if (Faye.indexOf(connectionTypes, connType) < 0) return;
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

Faye.extend(Faye.Transport.prototype, Faye.Logging);

