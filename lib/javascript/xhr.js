Faye.XHR = {
  request: function(method, url, params, callbacks, scope) {
    var req = new this.Request(method, url, params, callbacks, scope);
    req.send();
    return req;
  },
  
  getXhrObject: function() {
    return Faye.ENV.ActiveXObject
        ? new ActiveXObject("Microsoft.XMLHTTP")
        : new XMLHttpRequest();
  },
  
  Request: Faye.Class({
    initialize: function(method, url, params, callbacks, scope) {
      this._method    = method.toUpperCase();
      this._endpoint  = Faye.URI.parse(url, params);
      this._callbacks = (typeof callbacks === 'function') ? {success: callbacks} : callbacks;
      this._scope     = scope || null;
      this._xhr       = null;
    },
    
    send: function() {
      if (this._waiting) return;
      
      var path = this._endpoint.pathname, qs = this._endpoint.queryString();
      if (this._method === 'GET') path += '?' + qs;
      
      var body = this._method === 'POST' ? qs : '';
      
      this._waiting = true;
      this._xhr = Faye.XHR.getXhrObject();
      this._xhr.open(this._method, path, true);
      
      if (this._method === 'POST')
        this._xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      
      var self = this, handleState = function() {
        if (self._xhr.readyState !== 4) return;
        
        if (poll) {
          clearInterval(poll);
          poll = null;
        }
        
        Faye.Event.detach(window, 'unload', self.abort, self);
        self._waiting = false;
        self._handleResponse();
        self = null;
      };
      
      var poll = setInterval(handleState, 10);
      Faye.Event.on(window, 'unload', this.abort, this);
      this._xhr.send(body);
    },
    
    abort: function() {
      this._xhr.abort();
    },
    
    _handleResponse: function() {
      var cb = this._callbacks;
      if (!cb) return;
      return this.success()
          ? cb.success && cb.success.call(this._scope, this)
          : cb.failure && cb.failure.call(this._scope, this);
    },
    
    waiting: function() {
      return !!this._waiting;
    },
    
    complete: function() {
      return this._xhr && !this.waiting();
    },
    
    success: function() {
      if (!this.complete()) return false;
      var status = this._xhr.status;
      return (status >= 200 && status < 300) || status === 304 || status === 1223;
    },
    
    failure: function() {
      if (!this.complete()) return false;
      return !this.success();
    },
    
    text: function() {
      if (!this.complete()) return null;
      return this._xhr.responseText;
    },
    
    status: function() {
      if (!this.complete()) return null;
      return this._xhr.status;
    }
  })
};

