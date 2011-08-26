Faye.WebSocket.API = {
  onopen:     null,
  onmessage:  null,
  onerror:    null,
  onclose:    null,
  
  receive: function(data) {
    var event = new Faye.WebSocket.Event();
    event.initEvent('message', false, false);
    event.data = data;
    this.dispatchEvent(event);
  },
  
  send: function(data, type, errorType) {
    this._parser.frame(this._stream, data, type, errorType);
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
};

Faye.extend(Faye.WebSocket.API, Faye.Publisher);
// Faye.extend(Faye.WebSocket.Client.prototype, Faye.WebSocket.API);
Faye.extend(Faye.WebSocket.prototype, Faye.WebSocket.API);

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
