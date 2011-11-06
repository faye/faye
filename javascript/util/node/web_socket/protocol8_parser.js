Faye.WebSocket.Protocol8Parser = Faye.Class({
  <% %w[FIN MASK RSV1 RSV2 RSV3 OPCODE LENGTH].each do |const| %>
    <%= const %>: <%= Faye::WebSocket::Protocol8Parser.const_get(const) %>,
  <% end %>
  
  GUID: '<%= Faye::WebSocket::Protocol8Parser::GUID %>',
  
  OPCODES: <%= JSON.dump Faye::WebSocket::Protocol8Parser::OPCODES %>,
  FRAGMENTED_OPCODES: <%= JSON.dump Faye::WebSocket::Protocol8Parser::FRAGMENTED_OPCODES %>,
  OPENING_OPCODES: <%= JSON.dump Faye::WebSocket::Protocol8Parser::OPENING_OPCODES %>,
  
  ERRORS: <%= JSON.dump Faye::WebSocket::Protocol8Parser::ERRORS %>,
  
  ERROR_CODES: <%= JSON.dump Faye::WebSocket::Protocol8Parser::ERROR_CODES %>,
  
  UTF8_MATCH: <%= Faye::UTF8_MATCH.inspect %>,
  
  version: 'protocol-8',
  
  Handshake: Faye.Class({
    initialize: function(uri, stream) {
      this._uri    = uri;
      this._stream = stream;
      
      var buffer = new Buffer(16), i = 16;
      while (i--) buffer[i] = Math.floor(Math.random() * 254);
      this._key = buffer.toString('base64');
      
      var SHA1 = crypto.createHash('sha1');
      SHA1.update(this._key + Faye.WebSocket.Protocol8Parser.prototype.GUID);
      this._accept = SHA1.digest('base64');
      
      var HTTPParser = process.binding('http_parser').HTTPParser,
          parser     = new HTTPParser('response'),
          current    = null,
          self       = this;
      
      this._complete = false;
      this._headers  = {};
      this._parser   = parser;
      
      parser.onHeaderField = function(b, start, length) {
        current = b.toString('utf8', start, start + length);
      };
      parser.onHeaderValue = function(b, start, length) {
        self._headers[current] = b.toString('utf8', start, start + length);
      };
      parser.onHeadersComplete = function(settings) {
        self._status = settings.statusCode;
      };
      parser.onMessageComplete = function() {
        self._complete = true;
      };
    },
    
    requestData: function() {
      var stream = this._stream;
      try {
        stream.write('GET ' + this._uri.pathname + ' HTTP/1.1\r\n');
        stream.write('Host: ' + this._uri.hostname + '\r\n');
        stream.write('Upgrade: websocket\r\n');
        stream.write('Connection: Upgrade\r\n');
        stream.write('Sec-WebSocket-Key: ' + this._key + '\r\n');
        stream.write('Sec-WebSocket-Version: 8\r\n');
        stream.write('\r\n');
      } catch (e) {}
    },
    
    parse: function(data) {
      this._parser.execute(data, 0, data.length);
    },
    
    isComplete: function() {
      return this._complete;
    },
    
    isValid: function() {
      if (this._status !== 101) return false;
      
      var upgrade    = this._headers.Upgrade,
          connection = this._headers.Connection;
      
      return upgrade && /^websocket$/i.test(upgrade) &&
             connection && connection.split(/\s*,\s*/).indexOf('Upgrade') >= 0 &&
             this._headers['Sec-WebSocket-Accept'] === this._accept;
    }
  }),
  
  initialize: function(webSocket, stream) {
    this._reset();
    this._socket = webSocket;
    this._stream = stream;
    this._stage  = 0;
  },
  
  handshakeResponse: function() {
    var secKey = this._socket.request.headers['sec-websocket-key'];
    if (!secKey) return;
    
    var SHA1 = crypto.createHash('sha1');
    SHA1.update(secKey + this.GUID);
    var accept = SHA1.digest('base64');
    
    var stream = this._stream;
    try {
      stream.write('HTTP/1.1 101 Switching Protocols\r\n');
      stream.write('Upgrade: websocket\r\n');
      stream.write('Connection: Upgrade\r\n');
      stream.write('Sec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    } catch (e) {
      // socket closed while writing
      // no handshake sent; client will stop using WebSocket
    }
  },
  
  createHandshake: function() {
    return new this.Handshake(this._socket.uri, this._stream);
  },
  
  parse: function(data) {
    for (var i = 0, n = data.length; i < n; i++) {
      switch (this._stage) {
        case 0: this._parseOpcode(data[i]);         break;
        case 1: this._parseLength(data[i]);         break;
        case 2: this._parseExtendedLength(data[i]); break;
        case 3: this._parseMask(data[i]);           break;
        case 4: this._parsePayload(data[i]);        break;
      }
      if (this._stage === 4 && this._length === 0)
        this._emitFrame();
    }
  },
  
  frame: function(data, type, errorType) {
    if (this._closed) return;
    
    var opcode = this.OPCODES[type || (typeof data === 'string' ? 'text' : 'binary')],
        buffer = new Buffer(data),
        error  = this.ERRORS[errorType],
        insert = error ? 2 : 0,
        length = buffer.length + insert,
        stream = this._stream,
        frame, factor;
    
    if (length <= 125) {
      frame = new Buffer(2 + insert);
      frame[1] = length;
    } else if (length >= 126 && length <= 65535) {
      frame = new Buffer(4 + insert);
      frame[1] = 126;
      frame[2] = Math.floor(length / 256);
      frame[3] = length & 255;
    } else {
      frame = new Buffer(10 + insert);
      frame[1] = 127;
      for (var i = 0; i < 8; i++) {
        factor = Math.pow(2, 8 * (8 - 1 - i));
        frame[2+i] = Math.floor(length / factor) & 255;
      }
    }
    frame[0] = this.FIN | opcode;
    
    if (error) {
      frame[frame.length - 2] = Math.floor(error / 256);
      frame[frame.length - 1] = error & 255;
    }
    
    try {
      stream.write(frame, 'binary');
      if (buffer.length > 0) stream.write(buffer, 'utf8');
      return true;
    } catch (e) {
      return false;
    }
  },
  
  close: function(errorType, callback, context) {
    if (this._closed) return;
    if (callback) this._closingCallback = [callback, context];
    this.frame('', 'close', errorType || 'normal_closure');
    this._closed = true;
  },
  
  buffer: function(fragment) {
    for (var i = 0, n = fragment.length; i < n; i++)
      this._buffer.push(fragment[i]);
  },
  
  _parseOpcode: function(data) {
    var rsvs = [this.RSV1, this.RSV2, this.RSV3].filter(function(rsv) {
      return (data & rsv) === rsv;
    }, this);
    
    if (rsvs.length > 0) return this._socket.close('protocol_error');
    
    this._final   = (data & this.FIN) === this.FIN;
    this._opcode  = (data & this.OPCODE);
    this._mask    = [];
    this._payload = [];
    
    var valid = false;
    
    for (var key in this.OPCODES) {
      if (this.OPCODES[key] === this._opcode)
        valid = true;
    }
    if (!valid) return this._socket.close('protocol_error');
    
    if (Faye.indexOf(this.FRAGMENTED_OPCODES, this._opcode) < 0 && !this._final)
      return this._socket.close('protocol_error');
    
    if (this._mode && Faye.indexOf(this.OPENING_OPCODES, this._opcode) >= 0)
      return this._socket.close('protocol_error');
    
    this._stage = 1;
  },
  
  _parseLength: function(data) {
    this._masked = (data & this.MASK) === this.MASK;
    this._length = (data & this.LENGTH);
    
    if (this._length >= 0 && this._length <= 125) {
      this._stage = this._masked ? 3 : 4;
    } else {
      this._lengthBuffer = [];
      this._lengthSize   = (this._length === 126 ? 2 : 8);
      this._stage        = 2;
    }
  },
  
  _parseExtendedLength: function(data) {
    this._lengthBuffer.push(data);
    if (this._lengthBuffer.length < this._lengthSize) return;
    this._length = this._getInteger(this._lengthBuffer);
    this._stage  = this._masked ? 3 : 4;
  },
  
  _parseMask: function(data) {
    this._mask.push(data);
    if (this._mask.length < 4) return;
    this._stage = 4;
  },
  
  _parsePayload: function(data) {
    this._payload.push(data);
    if (this._payload.length < this._length) return;
    this._emitFrame();
  },
  
  _emitFrame: function() {
    var payload = this._unmask(this._payload, this._mask),
        opcode  = this._opcode;
    
    if (opcode === this.OPCODES.continuation) {
      if (!this._mode) return this._socket.close('protocol_error');
      this.buffer(payload);
      if (this._final) {
        var message = new Buffer(this._buffer);
        if (this._mode === 'text') message = this._encode(message);
        this._reset();
        if (message !== null) this._socket.receive(message);
        else this._socket.close('encoding_error');
      }
    }
    else if (opcode === this.OPCODES.text) {
      if (this._final) {
        var message = this._encode(payload);
        if (message !== null) this._socket.receive(message);
        else this._socket.close('encoding_error');
      } else {
        this._mode = 'text';
        this.buffer(payload);
      }
    }
    else if (opcode === this.OPCODES.binary) {
      if (this._final) {
        this._socket.receive(payload);
      } else {
        this._mode = 'binary';
        this.buffer(payload);
      }
    }
    else if (opcode === this.OPCODES.close) {
      var errorCode = (payload.length >= 2) ? 256 * payload[0] + payload[1] : 0,
          
          errorType = (payload.length === 0) ||
                      (errorCode >= 3000 && errorCode < 5000) ||
                      Faye.indexOf(this.ERROR_CODES, errorCode) >= 0 ?
                      'normal_closure' :
                      'protocol_error';
      
      if (payload.length > 125 || (payload.length > 2 && !this._encode(payload.slice(2))))
        errorType = 'protocol_error';
      
      this._socket.close(errorType);
      if (this._closingCallback)
        this._closingCallback[0].call(this._closingCallback[1]);
    }
    else if (opcode === this.OPCODES.ping) {
      if (payload.length > 125) return this._socket.close('protocol_error');
      this._socket.send(payload, 'pong');
    }
    this._stage = 0;
  },
  
  _reset: function() {
    this._mode   = null;
    this._buffer = [];
  },
  
  _encode: function(buffer) {
    try {
      var string = buffer.toString('binary', 0, buffer.length);
      if (!this.UTF8_MATCH.test(string)) return null;
    } catch (e) {}
    return buffer.toString('utf8', 0, buffer.length);
  },
  
  _getInteger: function(bytes) {
    var number = 0;
    for (var i = 0, n = bytes.length; i < n; i++)
      number += bytes[i] << (8 * (n - 1 - i));
    return number;
  },
  
  _unmask: function(payload, mask) {
    var unmasked = new Buffer(payload.length), b;
    for (var i = 0, n = payload.length; i < n; i++) {
      b = payload[i];
      if (mask.length > 0) b = b ^ mask[i % 4];
      unmasked[i] = b;
    }
    return unmasked;
  }
});
