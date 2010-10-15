/**
 * Generic WebSocket implementation for Node
 * -----------------------------------------
 * 
 * Though primarily here to support WebSockets as a network
 * transport in Faye, it would be nice for this class to
 * implement the same interface as the client-side WebSocket
 * for ease of use.
 * 
 * For implementation reference:
 * http://dev.w3.org/html5/websockets/
 * http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol-75
 * http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol-76
 * http://www.w3.org/TR/DOM-Level-2-Events/events.html
 **/

var Buffer = require('buffer').Buffer,
    crypto = require('crypto');

Faye.WebSocket = Faye.Class({
  onopen:     null,
  onmessage:  null,
  onerror:    null,
  onclose:    null,
  
  initialize: function(request, head) {
    this._request = request;
    this._head    = head;
    this._stream  = request.socket;
    
    var scheme = request.socket.secure ? 'wss:' : 'ws:';
    this.url = scheme + '//' + request.headers.host + request.url;    
    this.readyState = Faye.WebSocket.CONNECTING;
    this.bufferedAmount = 0;
    
    this._handler = Faye.WebSocket.getHandler(request);
    this._handler.handshake(this.url, this._request, this._head, this._stream);
    this.readyState = Faye.WebSocket.OPEN;
    
    var event = new Faye.WebSocket.Event();
    event.initEvent('open', false, false);
    this.dispatchEvent(event);
    
    this._buffer = [];
    this._buffering = false;
    
    var self = this;
    
    this._stream.addListener('data', function(data) {
      for (var i = 0, n = data.length; i < n; i++)
        self._handleChar(data[i]);
    });
  },
  
  send: function(data) {
    this._handler.send(this._stream, data);
    return true;
  },
  
  close: function() {},
  
  addEventListener: function(type, listener, useCapture) {
    this.addSubscriber(type, listener);
  },
  
  removeEventListener: function(type, listener, useCapture) {
    this.removeSubscriber(type, listener);
  },
  
  dispatchEvent: function(event) {
    event.target = event.currentTarget = this;
    event.eventPhase = Faye.WebSocket.Event.AT_TARGET;
    
    this.publishEvent(event.type, event);
    if (this['on' + event.type])
      this['on' + event.type](event);
  },
  
  _handleChar: function(data) {
    switch (data) {
      case 0x00:
        this._buffering = true;
        break;
      
      case 0xFF:
        this._buffer = new Buffer(this._buffer);
        
        var event = new Faye.WebSocket.Event();
        event.initEvent('message', false, false);
        event.data = this._buffer.toString('utf8', 0, this._buffer.length);
        
        this.dispatchEvent(event);
        
        this._buffer = [];
        this._buffering = false;
        break;
      
      default:
        if (this._buffering) this._buffer.push(data);
    }
  }
});

Faye.extend(Faye.WebSocket.prototype, Faye.Publisher);

Faye.extend(Faye.WebSocket, {
  CONNECTING:   0,
  OPEN:         1,
  CLOSING:      2,
  CLOSED:       3,
  
  Event: Faye.extend(Faye.Class({
    initEvent: function(eventType, canBubble, cancelable) {
      this.type       = eventType;
      this.bubbles    = canBubble;
      this.cancelable = cancelable;
    },
    
    stopPropagation: function() {},
    preventDefault: function() {}
    
  }), {
    CAPTURING_PHASE:  1,
    AT_TARGET:        2,
    BUBBLING_PHASE:   3
  }),
  
  getHandler: function(request) {
    var headers = request.headers;
    return (headers['sec-websocket-key1'] && headers['sec-websocket-key2'])
         ? this.Protocol76
         : this.Protocol75;
  }
});

(function() {
  var byteToChar = function(value) {
    if (typeof value === 'string') value = parseInt(value, 16);
    return String.fromCharCode(value);
  };
  
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
  
  var writeToSocket = function(socket, message) {
    try {
      socket.write(FRAME_START, 'binary');
      socket.write(message, 'utf8');
      socket.write(FRAME_END, 'binary');
    } catch (e) {
      // socket closed while writing
    }
  };
  
  var FRAME_START = byteToChar('00'),
      FRAME_END   = byteToChar('FF');
  
  Faye.WebSocket.Protocol75 = {
    handshake: function(url, request, head, socket) {
      socket.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n');
      socket.write('Upgrade: WebSocket\r\n');
      socket.write('Connection: Upgrade\r\n');
      socket.write('WebSocket-Origin: ' + request.headers.origin + '\r\n');
      socket.write('WebSocket-Location: ' + url + '\r\n');
      socket.write('\r\n');
    },
    
    send: function(socket, message) {
      writeToSocket(socket, message);
    }
  };
  
  Faye.WebSocket.Protocol76 = {
    handshake: function(url, request, head, socket) {
      var key1   = request.headers['sec-websocket-key1'],
          value1 = numberFromKey(key1) / spacesInKey(key1),
          
          key2   = request.headers['sec-websocket-key2'],
          value2 = numberFromKey(key2) / spacesInKey(key2),
          
          MD5    = crypto.createHash('md5');
      
      MD5.update(bigEndian(value1));
      MD5.update(bigEndian(value2));
      MD5.update(head.toString('binary'));
      
      socket.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n', 'binary');
      socket.write('Upgrade: WebSocket\r\n', 'binary');
      socket.write('Connection: Upgrade\r\n', 'binary');
      socket.write('Sec-WebSocket-Origin: ' + request.headers.origin + '\r\n', 'binary');
      socket.write('Sec-WebSocket-Location: ' + url + '\r\n', 'binary');
      socket.write('\r\n', 'binary');
      socket.write(MD5.digest('binary'), 'binary');
    },
    
    send: function(socket, message) {
      writeToSocket(socket, message);
    }
  }
})();

