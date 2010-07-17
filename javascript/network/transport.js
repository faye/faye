Faye.Transport = Faye.extend(Faye.Class({
  initialize: function(client, endpoint) {
    this.debug('Created new ? transport for ?', this.connectionType, endpoint);
    this._client    = client;
    this._endpoint  = endpoint;
  },
  
  send: function(messages, timeout) {
    messages = [].concat(messages);
    
    this.debug('Client ? sending message to ?: ?',
               this._client._clientId, this._endpoint, messages);
    
    return this.request(messages, timeout);
  },
  
  receive: function(responses) {
    this.debug('Client ? received from ?: ?',
               this._client._clientId, this._endpoint, responses);
    
    Faye.each(responses, this._client.receiveMessage, this._client);
  },
  
  retry: function(message, timeout) {
    var self = this;
    return function() {
      setTimeout(function() { self.request(message, 2 * timeout) }, 1000 * timeout);
    };
  }
  
}), {
  get: function(client, connectionTypes) {
    var endpoint = client._endpoint;
    if (connectionTypes === undefined) connectionTypes = this.supportedConnectionTypes();
    
    var candidateClass = null;
    Faye.each(this._transports, function(pair) {
      var connType = pair[0], klass = pair[1];
      if (Faye.indexOf(connectionTypes, connType) < 0) return;
      if (candidateClass) return;
      if (klass.isUsable(endpoint)) candidateClass = klass;
    });
    
    if (!candidateClass) throw 'Could not find a usable connection type for ' + endpoint;
    
    return new candidateClass(client, endpoint);
  },
  
  register: function(type, klass) {
    this._transports.push([type, klass]);
    klass.prototype.connectionType = type;
  },
  
  _transports: [],
  
  supportedConnectionTypes: function() {
    return Faye.map(this._transports, function(pair) { return pair[0] });
  }
});

Faye.extend(Faye.Transport.prototype, Faye.Logging);

