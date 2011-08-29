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
    this.request = request;
    this._stream = request.socket;
    
    var scheme = Faye.WebSocket.isSecureConnection(request) ? 'wss:' : 'ws:';
    this.url = scheme + '//' + request.headers.host + request.url;    
    this.readyState = Faye.WebSocket.CONNECTING;
    this.bufferedAmount = 0;
    
    var Parser = Faye.WebSocket.getParser(request);
    this._parser = new Parser(this, this._stream);
    this._parser.handshakeResponse(head);
    
    this.readyState = Faye.WebSocket.OPEN;
    this.version = this._parser.version;
    
    var event = new Faye.WebSocket.Event();
    event.initEvent('open', false, false);
    this.dispatchEvent(event);
    
    var self = this;
    
    this._stream.addListener('data', function(data) {
      self._parser.parse(data);
    });
  },
  
  receive: function(data) {
    var event = new Faye.WebSocket.Event();
    event.initEvent('message', false, false);
    event.data = data;
    this.dispatchEvent(event);
  },
  
  send: function(data, type, errorType) {
    this._parser.frame(data, type, errorType);
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
  }),
  
  getParser: function(request) {
    var headers = request.headers;
    return headers['sec-websocket-version']
         ? this.Protocol8Parser
         : (headers['sec-websocket-key1'] && headers['sec-websocket-key2'])
         ? this.Draft76Parser
         : this.Draft75Parser;
  },
  
  isSecureConnection: function(request) {
    if (request.headers['x-forwarded-proto']) {
      return request.headers['x-forwarded-proto'] === 'https';
    } else {
      return (request.connection && request.connection.authorized !== undefined) ||
             (request.socket && request.socket.secure);
    }
  }
});

