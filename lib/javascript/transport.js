Faye.Transport = Faye.Class({
  initialize: function(endpoint) {
    this._endpoint = endpoint;
  },
  
  send: function(message, callback, scope) {
    message = {message: JSON.stringify(message)};
    return Faye.XHR.request('post', this._endpoint, message, function(response) {
      if (!callback) return;
      var responses = JSON.parse(response.text());
      if (!(responses instanceof Array)) responses = [responses];
      for (var i = 0, n = responses.length; i < n; i++) {
        try {
          callback.call(scope, responses[i]);
        } catch (e) {}
      }
    });              
  },
  
  handshake: function(callback, scope) {
    this.send({
      channel:    Faye.Channel.HANDSHAKE,
      version:    Faye.BAYEUX_VERSION,
      supportedConnectionTypes: ['long-polling']
    }, function(message) {
      callback.call(scope, message.clientId);
    });
  },
  
  connect: function(id, callback, scope) {
    if (this._connectRequest) return;
    this._connectRequest = this.send({
      channel:    Faye.Channel.CONNECT,
      clientId:   id,
      connectionType: 'long-polling'
    }, function(message) {
      delete this._connectRequest;
      callback.call(scope, message);
    }, this);
  },
  
  disconnect: function(id, callback, scope) {
    this.send({
      channel:    Faye.Channel.DISCONNECT,
      clientId:   id
    });
  }
});

