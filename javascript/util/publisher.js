Faye.Publisher = {
  countSubscribers: function(eventType) {
    if (!this._subscribers || !this._subscribers[eventType]) return 0;
    return this._subscribers[eventType].length;
  },
  
  addSubscriber: function(eventType, listener, context) {
    this._subscribers = this._subscribers || {};
    var list = this._subscribers[eventType] = this._subscribers[eventType] || [];
    list.push([listener, context]);
  },
  
  removeSubscriber: function(eventType, listener, context) {
    if (!this._subscribers || !this._subscribers[eventType]) return;
    
    var list = this._subscribers[eventType],
        i    = list.length;
    
    while (i--) {
      if (listener && list[i][0] !== listener) continue;
      if (context && list[i][1] !== context) continue;
      list.splice(i,1);
    }
  },
  
  publishEvent: function() {
    var args = Array.prototype.slice.call(arguments),
        eventType = args.shift();
    
    if (!this._subscribers || !this._subscribers[eventType]) return;
    
    Faye.each(this._subscribers[eventType], function(listener) {
      listener[0].apply(listener[1], args.slice());
    });
  }
};

