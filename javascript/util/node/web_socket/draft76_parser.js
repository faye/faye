Faye.WebSocket.Draft76Parser = Faye.Class(Faye.WebSocket.Draft75Parser, {
  version: 'draft-76',
  
  handshakeResponse: function(socket, head) {
    var request = this._socket.request,
        
        key1    = request.headers['sec-websocket-key1'],
        value1  = this._numberFromKey(key1) / this._spacesInKey(key1),
        
        key2    = request.headers['sec-websocket-key2'],
        value2  = this._numberFromKey(key2) / this._spacesInKey(key2),
        
        MD5     = crypto.createHash('md5');
    
    MD5.update(this._bigEndian(value1));
    MD5.update(this._bigEndian(value2));
    MD5.update(head.toString('binary'));
    
    try {
      socket.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n', 'binary');
      socket.write('Upgrade: WebSocket\r\n', 'binary');
      socket.write('Connection: Upgrade\r\n', 'binary');
      socket.write('Sec-WebSocket-Origin: ' + request.headers.origin + '\r\n', 'binary');
      socket.write('Sec-WebSocket-Location: ' + this._socket.url + '\r\n\r\n', 'binary');
      socket.write(MD5.digest('binary'), 'binary');
    } catch (e) {
      // socket closed while writing
      // no handshake sent; client will stop using WebSocket
    }
  },
  
  _numberFromKey: function(key) {
    return parseInt(key.match(/[0-9]/g).join(''), 10);
  },
  
  _spacesInKey: function(key) {
    return key.match(/ /g).length;
  },
  
  _bigEndian: function(number) {
    var string = '';
    Faye.each([24,16,8,0], function(offset) {
      string += String.fromCharCode(number >> offset & 0xFF);
    });
    return string;
  }  
});
