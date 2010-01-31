Faye.Observable = {
  on: function(eventType, block, scope) {
    this._observers = this._observers || {};
    var list = this._observers[eventType] = this._observers[eventType] || [];
    list.push([block, scope]);
  }
};

