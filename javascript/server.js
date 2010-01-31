Faye.Server = Faye.Class({
  initialize: function(options) {
    this._options = options || {};
  },
  
  process: function(message, local, callback) {
    callback(message);
  }
});

