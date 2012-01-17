Faye.Deferrable = {
  callback: function(callback, scope) {
    if (!callback) return;
    
    if (this._deferredStatus === 'succeeded')
      return callback.apply(scope, this._deferredArgs);
    
    this._callbacks = this._callbacks || [];
    this._callbacks.push([callback, scope]);
  },
  
  timeout: function(seconds, message) {
    var _this = this;
    var timer = Faye.ENV.setTimeout(function() {
      _this.setDeferredStatus('failed', message);
    }, seconds * 1000);
    this._timer = timer;
  },
  
  errback: function(callback, scope) {
    if (!callback) return;

    if (this._deferredStatus === 'failed')
      return callback.apply(scope, this._deferredArgs);

    this._errbacks = this._errbacks || [];
    this._errbacks.push([callback, scope]);
  },

  setDeferredStatus: function() {
    if (this._timer)
      Faye.ENV.clearTimeout(this._timer);

    var args   = Array.prototype.slice.call(arguments),
        status = args.shift(),
        callbacks;
    
    this._deferredStatus = status;
    this._deferredArgs = args;
    
    if (status === 'succeeded')
      callbacks = this._callbacks;
    else if (status === 'failed')
      callbacks = this._errbacks;
    
    if (!callbacks) return;
    
    var callback;
    while (callback = callbacks.shift())
      callback[0].apply(callback[1], this._deferredArgs);
  }
};

