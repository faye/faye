Faye.Extensible = {
  addExtension: function(extension) {
    this._extensions = this._extensions || [];
    this._extensions.push(extension);
  },
  
  removeExtension: function(extension) {
    if (!this._extensions) return;
    var i = this._extensions.length;
    while (i--) {
      if (this._extensions[i] === extension)
        this._extensions.splice(i,1);
    }
  },
  
  pipeThroughExtensions: function(stage, message, callback, scope) {
    if (!this._extensions) return callback.call(scope, message);
    var extensions = this._extensions.slice();
    
    var pipe = function(message) {
      if (!message) return callback.call(scope, message);
      
      var extension = extensions.shift();
      if (!extension) return callback.call(scope, message);
      
      if (extension[stage]) extension[stage](message, pipe);
      else pipe(message);
    };
    pipe(message);
  }
};

