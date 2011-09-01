Faye.WebSocket.Draft75Parser = Faye.Class({
  FRAME_START : new Buffer([0x00]),
  FRAME_END   : new Buffer([0xFF]),
  
  version     : 'draft-75',
  
  initialize: function(webSocket, stream) {
    this._socket    = webSocket;
    this._stream    = stream;
    this._buffer    = [];
    this._buffering = false;
  },
  
  handshakeResponse: function() {
    var stream = this._stream;
    try {
      stream.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n');
      stream.write('Upgrade: WebSocket\r\n');
      stream.write('Connection: Upgrade\r\n');
      stream.write('WebSocket-Origin: ' + this._socket.request.headers.origin + '\r\n');
      stream.write('WebSocket-Location: ' + this._socket.url + '\r\n\r\n');
    } catch (e) {
      // socket closed while writing
      // no handshake sent; client will stop using WebSocket
    }
  },
  
  parse: function(data) {
    for (var i = 0, n = data.length; i < n; i++)
      this._handleChar(data[i]);
  },
  
  frame: function(data) {
    var stream = this._stream;
    try {
      stream.write(this.FRAME_START, 'binary');
      stream.write(new Buffer(data), 'utf8');
      stream.write(this.FRAME_END, 'binary');
      return true;
    } catch (e) {
      return false;
    }
  },
  
  _handleChar: function(data) {
    switch (data) {
      case 0x00:
        this._buffering = true;
        break;
      
      case 0xFF:
        this._buffer = new Buffer(this._buffer);
        this._socket.receive(this._buffer.toString('utf8', 0, this._buffer.length));
        this._buffer = [];
        this._buffering = false;
        break;
      
      default:
        if (this._buffering) this._buffer.push(data);
    }
  }
});
