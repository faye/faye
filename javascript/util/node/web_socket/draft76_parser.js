Faye.WebSocket.Draft76Parser = Faye.Class(Faye.WebSocket.Draft75Parser, {
  version: 'draft-76'
});

(function() {
  var numberFromKey = function(key) {
    return parseInt(key.match(/[0-9]/g).join(''), 10);
  };
  
  var spacesInKey = function(key) {
    return key.match(/ /g).length;
  };
  
  var bigEndian = function(number) {
    var string = '';
    Faye.each([24,16,8,0], function(offset) {
      string += String.fromCharCode(number >> offset & 0xFF);
    });
    return string;
  };
  
  Faye.WebSocket.Draft76Parser.handshake = function(url, request, head, socket) {
    var key1   = request.headers['sec-websocket-key1'],
        value1 = numberFromKey(key1) / spacesInKey(key1),
        
        key2   = request.headers['sec-websocket-key2'],
        value2 = numberFromKey(key2) / spacesInKey(key2),
        
        MD5    = crypto.createHash('md5');
    
    MD5.update(bigEndian(value1));
    MD5.update(bigEndian(value2));
    MD5.update(head.toString('binary'));
    
    try {
      socket.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n', 'binary');
      socket.write('Upgrade: WebSocket\r\n', 'binary');
      socket.write('Connection: Upgrade\r\n', 'binary');
      socket.write('Sec-WebSocket-Origin: ' + request.headers.origin + '\r\n', 'binary');
      socket.write('Sec-WebSocket-Location: ' + url + '\r\n', 'binary');
      socket.write('\r\n', 'binary');
      socket.write(MD5.digest('binary'), 'binary');
    } catch (e) {
      // socket closed while writing
      // no handshake sent; client will stop using WebSocket
    }
  };
})();

