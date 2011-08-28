Faye.WebSocket.Client = Faye.Class({
  initialize: function(url) {
    this.url = url;
    this.uri = require('url').parse(url);
    
    this.readyState = Faye.WebSocket.CONNECTING;
    
    var connection = require('net').createConnection(this.uri.port || 80, this.uri.hostname),
        self       = this;
    
    this._parser = new Faye.WebSocket.Protocol8Parser(this, connection);
    
    connection.addListener('connect', function() {
      self._onConnect();
    });
    connection.addListener('data', function(data) {
      self._onData(data);
    });
    this._stream = connection;
  },
  
  _onConnect: function() {
    this._handshake = this._parser.createHandshake(this.uri);
    this._handshake.requestData();
  },
  
  _onData: function(data) {
    switch (this.readyState) {
      case Faye.WebSocket.CONNECTING:
        this._handshake.parse(data);
        if (!this._handshake.isComplete()) return;
        
        if (this._handshake.isValid()) {
          this.readyState = Faye.WebSocket.OPEN;
          var event = new Faye.WebSocket.Event();
          event.initEvent('open', false, false);
          this.dispatchEvent(event);
        } else {
          this.readyState = Faye.WebSocket.CLOSED;
          var event = new Faye.WebSocket.Event();
          event.initEvent('close', false, false);
          this.dispatchEvent(event);
        }
        break;
        
      case Faye.WebSocket.OPEN:
        this._parser.parse(data);
    }
  }
});
