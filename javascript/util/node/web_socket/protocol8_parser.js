Faye.WebSocket.Protocol8Parser = Faye.Class({
  FIN:    <%= Faye::WebSocket::Protocol8Parser::FIN %>,
  MASK:   <%= Faye::WebSocket::Protocol8Parser::MASK %>,
  RSV1:   <%= Faye::WebSocket::Protocol8Parser::RSV1 %>,
  RSV2:   <%= Faye::WebSocket::Protocol8Parser::RSV2 %>,
  RSV3:   <%= Faye::WebSocket::Protocol8Parser::RSV3 %>,
  OPCODE: <%= Faye::WebSocket::Protocol8Parser::OPCODE %>,
  LENGTH: <%= Faye::WebSocket::Protocol8Parser::LENGTH %>,
  
  OPCODES: {
    continuation: 0,
    text:         1,
    binary:       2,
    close:        8,
    ping:         9,
    pong:         10
  },
  
  version: 'protocol-8',
  
  initialize: function(webSocket) {
    this._reset();
    this._socket = webSocket;
  },
  
  parse: function(data) {
    var byte0   = data[0],
        isFinal = (byte0 & this.FIN) === this.FIN,
        opcode  = (byte0 & this.OPCODE),
        valid   = false;
    
    for (var key in this.OPCODES) {
      if (this.OPCODES[key] === opcode)
        valid = true;
    }
    if (!valid) return this._close();
    
    if (opcode !== this.OPCODES.continuation)
      this._reset();
    
    var byte1  = data[1],
        masked = (byte1 & this.MASK) === this.MASK,
        length = (byte1 & this.LENGTH),
        offset = 0;
    
    if (length === 126) {
      length = this._getInteger(data, 2, 2);
      offset = 2;
    } else if (length === 127) {
      length = this._getInteger(data, 2, 8);
      offset = 8;
    }
    
    var payloadOffset, maskOctets;
    if (masked) {
      payloadOffset = 2 + offset + 4;
      maskOctets    = Faye.map([0,1,2,3], function(i) { return data[2 + offset + i] });
    } else {
      payloadOffset = 2 + offset;
      maskOctets    = [];
    }
    
    if (data[payloadOffset + length] !== undefined) {
      return this._close();
    }
    
    var rawPayload = data.slice(payloadOffset, payloadOffset + length),
        payload    = this._unmask(rawPayload, maskOctets);
    
    if (opcode === this.OPCODES.continuation) {
      if (this._mode !== 'text') return;
      this._buffer.push(payload);
      if (isFinal) {
        var message = this._buffer.join('');
        this._reset();
        this._socket.receive(message);
      }
    }
    else if (opcode === this.OPCODES.text) {
      if (isFinal) {
        this._socket.receive(payload);
      } else {
        this._mode = 'text';
        this._buffer.push(payload);
      }
    }
    else if (opcode === this.OPCODES.close) {
      this._close();
    }
    else if (opcode === this.OPCODES.ping) {
      this._socket.send(payload, 'pong');
    }
  },
  
  frame: function(socket, data, type) {
    var opcode = this.OPCODES[type || 'text'],
        length = new Buffer(data).length,
        frame, factor;
    
    if (length <= 125) {
      frame = new Buffer(2);
      frame[1] = length;
    } else if (length >= 126 && length <= 65535) {
      frame = new Buffer(4);
      frame[1] = 126;
      frame[2] = Math.floor(length / 256);
      frame[3] = length & 255;
    } else {
      frame = new Buffer(10);
      frame[1] = 127;
      for (var i = 0; i < 8; i++) {
        factor = Math.pow(2, 8 * (8 - 1 - i));
        frame[2+i] = Math.floor(length / factor) & 255;
      }
    }
    frame[0] = this.FIN | opcode;
    
    socket.write(frame, 'binary');
    socket.write(data, 'utf8');
  },
  
  _reset: function() {
    this._mode   = null;
    this._buffer = [];
  },
  
  _close: function() {
    if (this._closed) return;
    this._closed = true;
    this._socket.send('', 'close');
  },
  
  _getInteger: function(data, offset, length) {
    var number = 0;
    for (var i = 0; i < length; i++)
      number += data[offset + i] << (8 * (length - 1 - i));
    return number;
  },
  
  _unmask: function(payload, maskOctets) {
    if (maskOctets.length === 0) return payload;
    var unmasked = new Buffer(payload.length);
    for (var i = 0, n = payload.length; i < n; i++)
      unmasked[i] = payload[i] ^ maskOctets[i % 4];
    return unmasked.toString('utf8', 0, unmasked.length);
  }
});

Faye.WebSocket.Protocol8Parser.handshake = function(url, request, head, socket) {
  var secKey = request.headers['sec-websocket-key'];
  if (!secKey) return;
  
  var SHA1 = crypto.createHash('sha1');
  SHA1.update(secKey + this.GUID);
  var accept = SHA1.digest('base64');
  
  try {
    socket.write('HTTP/1.1 101 Switching Protocols\r\n');
    socket.write('Upgrade: websocket\r\n');
    socket.write('Connection: Upgrade\r\n');
    socket.write('Sec-WebSocket-Accept: ' + accept + '\r\n');
    socket.write('\r\n');
  } catch (e) {
    // socket closed while writing
    // no handshake sent; client will stop using WebSocket
  }
};

Faye.WebSocket.Protocol8Parser.GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

