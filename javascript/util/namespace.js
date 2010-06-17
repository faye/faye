Faye.Namespace = Faye.Class({
  initialize: function() {
    this._used = {};
  },
  
  generate: function() {
    var name = Faye.random();
    while (this._used.hasOwnProperty(name))
      name = Faye.random();
    return this._used[name] = name;
  }
});

