Faye.Set = Faye.Class({
  initialize: function() {
    this._index = {};
  },
  
  add: function(item) {
    var key = (item.__id !== undefined) ? item.__id : item;
    if (this._index.hasOwnProperty(key)) return false;
    this._index[key] = item;
    return true;
  },
  
  isEmpty: function() {
    for (var key in this._index) {
      if (this._index.hasOwnProperty(key)) return false;
    }
    return true;
  },
  
  toArray: function() {
    var array = [];
    for (var key in this._index) {
      if (this._index.hasOwnProperty(key)) array.push(this._index[key]);
    }
    return array;
  }
});

