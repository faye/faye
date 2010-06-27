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
 * http://www.w3.org/TR/DOM-Level-2-Events/events.html
 **/

var Buffer = require('buffer').Buffer;

Faye.WebSocket = Faye.Class({
  initialize: function(request) {
    this._request = request;
    this._socket  = request.socket;
    
    this.url = 'ws://' + request.headers.host + request.url;
    this.readyState = Faye.WebSocket.CONNECTING;
    this.bufferedAmount = 0;
    
    this._handler = Faye.WebSocket.Protocol75;
    this._handler.handshake(this.url, this._request, this._socket);
    this.readyState = Faye.WebSocket.OPEN;
    
    var event = new Faye.WebSocket.Event();
    event.initEvent('open', false, false);
    this.dispatchEvent(event);
    
    this._buffer = [];
    this._buffering = false;
    
    var self = this;
    
    this._socket.addListener('data', function(data) {
      for (var i = 0, n = data.length; i < n; i++)
        self._handleChar(data[i]);
    });
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
  },
  
  onopen:     null,
  onmessage:  null,
  onerror:    null,
  onclose:    null,
  
  send: function(data) {
    this._handler.send(this._socket, data);
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
  })
});

(function() {
  var byteToChar = function(value) {
    if (typeof value === 'string') value = parseInt(value, 16);
    return String.fromCharCode(value);
  };
  
  var FRAME_START = byteToChar('00'),
      FRAME_END   = byteToChar('FF');
  
  Faye.WebSocket.Protocol75 = {
    handshake: function(url, request, socket) {
      socket.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n');
      socket.write('Upgrade: WebSocket\r\n');
      socket.write('Connection: Upgrade\r\n');
      socket.write('WebSocket-Origin: ' + request.headers.origin + '\r\n');
      socket.write('WebSocket-Location: ' + url + '\r\n');
      socket.write('\r\n');
    },
    
    send: function(socket, message) {
      socket.write(FRAME_START, 'binary');
      socket.write(message, 'utf8');
      socket.write(FRAME_END, 'binary');
    }
  };
})();

