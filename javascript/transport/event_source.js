Faye.Transport.EventSource = Faye.extend(Faye.Class(Faye.Transport, {
  initialize: function(client, endpoint) {
    Faye.Transport.prototype.initialize.call(this, client, endpoint);
    this._xhr = new Faye.Transport.XHR(client, endpoint);
    
    var socket = new EventSource(endpoint + '/' + client.getClientId()),
        self   = this;
    
    socket.onopen = function() {
      self.trigger('up');
    };
    
    socket.onerror = function() {
      self.trigger('down');
    };
    
    socket.onmessage = function(event) {
      self.receive(JSON.parse(event.data));
    };
    
    this._socket = socket;
  },
  
  request: function(message, timeout) {
    this._xhr.request(message, timeout);
  },
  
  close: function() {
    this._socket.close();
  }
}), {
  isUsable: function(client, endpoint, callback, context) {
    Faye.Transport.XHR.isUsable(client, endpoint, function(usable) {
      callback.call(context, usable && Faye.ENV.EventSource);
    });
  }
});

Faye.Transport.register('eventsource', Faye.Transport.EventSource);

