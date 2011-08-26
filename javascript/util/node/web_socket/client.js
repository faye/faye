Faye.WebSocket.Client = Faye.Class({
  initialize: function(url) {
    this._parser = new Faye.WebSocket.Protocol8Parser(this);
    
    this.url = url;
    this.uri = require('url').parse(url);
    
    this.readyState = Faye.WebSocket.CONNECTING;
    
    var connection = require('net').createConnection(this.uri.port || 80, this.uri.hostname),
        self       = this;
    
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
    this._handshake.requestData(this._stream);
  },
  
  _onData: function(data) {
    switch (this.readyState) {
      case Faye.WebSocket.CONNECTING:
        // TODO validate handshake
        this.readyState = Faye.WebSocket.OPEN;
        var event = new Faye.WebSocket.Event();
        event.initEvent('open', false, false);
        this.dispatchEvent(event);
        break;
        
      case Faye.WebSocket.OPEN:
        this._parser.parse(data);
    }
  }
});
