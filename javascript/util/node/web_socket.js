/**
 * For implementation reference:
 * http://dev.w3.org/html5/websockets/
 * http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol-75
 * http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol-76
 * http://tools.ietf.org/html/draft-ietf-hybi-thewebsocketprotocol-10
 * http://www.w3.org/TR/DOM-Level-2-Events/events.html
 **/

var Buffer = require('buffer').Buffer,
    crypto = require('crypto'),
    net    = require('net');

Faye.WebSocket = Faye.Class({
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
  }
});

Faye.extend(Faye.WebSocket, {
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
