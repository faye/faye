Faye.Publisher = {
  countListeners: function(eventType) {
    if (!this._subscribers || !this._subscribers[eventType]) return 0;
    return this._subscribers[eventType].length;
  },
  
  bind: function(eventType, listener, context) {
    this._subscribers = this._subscribers || {};
    var list = this._subscribers[eventType] = this._subscribers[eventType] || [];
    list.push([listener, context]);
  },
  
  unbind: function(eventType, listener, context) {
    if (!this._subscribers || !this._subscribers[eventType]) return;
    
    if (!listener) {
      delete this._subscribers[eventType];
      return;
    }
    var list = this._subscribers[eventType],
        i    = list.length;
    
    while (i--) {
      if (listener !== list[i][0]) continue;
      if (context && list[i][1] !== context) continue;
      list.splice(i,1);
    }
  },
  
  trigger: function() {
    var args = Array.prototype.slice.call(arguments),
        eventType = args.shift();
    
    if (!this._subscribers || !this._subscribers[eventType]) return;
    
    var listeners = this._subscribers[eventType].slice(),
        listener;
    
    for (var i = 0, n = listeners.length; i < n; i++) {
      listener = listeners[i];
      listener[0].apply(listener[1], args);
    }
  }
};

