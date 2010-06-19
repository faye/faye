Faye.Transport = Faye.extend(Faye.Class({
  initialize: function(client, endpoint) {
    this.debug('Created new ? transport for ?', this.connectionType, endpoint);
    this._client    = client;
    this._endpoint  = endpoint;
    this._namespace = new Faye.Namespace();
  },
  
  send: function(message, callback, scope) {
    if (!(message instanceof Array) && !message.id)
      message.id = this._namespace.generate();
    
    this.debug('Client ? sending message to ?: ?',
               this._client._clientId, this._endpoint, message);
    
    return this.request(message, function(responses) {
      this.debug('Client ? received from ?: ?',
                 this._client._clientId, this._endpoint, responses);
      
      if (!callback) return;
      
      var responses   = [].concat(responses),
          messages    = [],
          deliverable = true,
          processed   = 0;
      
      var ping = function() {
        processed += 1;
        if (processed < responses.length) return;
        if (deliverable) this._client.deliverMessages(messages);
      };
      
      var handleResponse = function(response) {
        this._client.pipeThroughExtensions('incoming', response, function(response) {
          if (response) {
            if (response.id === message.id) {
              if (callback.call(scope, response) === false)
                deliverable = false;
            }
            
            if (response.advice)
              this._client.handleAdvice(response.advice);
            
            if (response.data && response.channel)
              messages.push(response);
          }
          
          ping.call(this);
        }, this);
      };
      
      Faye.each(responses, handleResponse, this);
    }, this);
  },
  
  abort: function() {}
  
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
    var list = [], key;
    Faye.each(this._transports, function(pair) { list.push(pair[0]) });
    return list;
  }
});

Faye.extend(Faye.Transport.prototype, Faye.Logging);

