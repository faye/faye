Faye.Observable = {
  on: function(eventType, block, scope) {
    this._observers = this._observers || {};
    var list = this._observers[eventType] = this._observers[eventType] || [];
    list.push([block, scope]);
  },
  
  fire: function() {
    var args = Array.prototype.slice.call(arguments),
        eventType = args.shift();
    
    if (!this._observers || !this._observers[eventType]) return;
    
    this._observers[eventType].forEach(function(listener) {
      listener[0].apply(listener[1], args.slice());
    });
  }
};

