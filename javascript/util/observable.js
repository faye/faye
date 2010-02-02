Faye.Observable = {
  on: function(eventType, block, scope) {
    this._observers = this._observers || {};
    var list = this._observers[eventType] = this._observers[eventType] || [];
    list.push([block, scope]);
  },
  
  stopObserving: function(eventType, block, scope) {
    if (!this._observers || !this._observers[eventType]) return;
    
    if (!block) {
      delete this._observers[eventType];
      return;
    }
    var list = this._observers[eventType],
        i    = list.length;
    
    while (i--) {
      if (block && list[i][0] !== block) continue;
      if (scope && list[i][1] !== scope) continue;
      list.splice(i,1);
    }
  },
  
  fire: function() {
    var args = Array.prototype.slice.call(arguments),
        eventType = args.shift();
    
    if (!this._observers || !this._observers[eventType]) return;
    
    Faye.each(this._observers[eventType], function(listener) {
      listener[0].apply(listener[1], args.slice());
    });
  }
};

