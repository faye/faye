Faye.WebSocket.Client = Faye.Class({
  initialize: function(url) {
    this.url = url;
    this.uri = require('url').parse(url);
    
    this.readyState = Faye.WebSocket.CONNECTING;
    this.bufferedAmount = 0;
    
    var secure     = (this.uri.protocol === 'wss:'),
        self       = this,
        onConnect  = function() { self._onConnect() },
        
        connection = secure
                   ? tls.connect(this.uri.port || 443, this.uri.hostname, onConnect)
                   : net.createConnection(this.uri.port || 80, this.uri.hostname);
    
    this._parser = new Faye.WebSocket.Protocol8Parser(this, connection);
    this._stream = connection;
    
    if (!secure) connection.addListener('connect', onConnect);
    
    connection.addListener('data', function(data) {
      self._onData(data);
    });
    connection.addListener('close', function() {
      self.close();
    });
    connection.addListener('error', function() {});
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
      case Faye.WebSocket.CLOSING:
        this._parser.parse(data);
    }
  }
});
