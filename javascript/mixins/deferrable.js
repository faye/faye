Faye.Deferrable = {
  callback: function(callback, scope) {
    if (!callback) return;
    
    if (this._deferredStatus === 'succeeded')
      return callback.apply(scope, this._deferredArgs);
    
    this._waiters = this._waiters || [];
    this._waiters.push([callback, scope]);
  },
  
  setDeferredStatus: function() {
    var args = Array.prototype.slice.call(arguments),
        status = args.shift();
    
    this._deferredStatus = status;
    this._deferredArgs = args;
    
    if (status !== 'succeeded') return;
    if (!this._waiters) return;
    
    Faye.each(this._waiters, function(callback) {
      callback[0].apply(callback[1], this._deferredArgs);
    }, this);
    
    this._waiters = [];
  }
};

