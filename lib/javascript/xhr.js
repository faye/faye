Faye.XHR = {
  request: function(method, url, callbacks, scope) {
    var req = new this.Request(method, url, callbacks, scope);
    req.send();
    return req;
  },
  
  getXhrObject: function() {
    return Faye.ENV.ActiveXObject
        ? new ActiveXObject("Microsoft.XMLHTTP")
        : new XMLHttpRequest();
  },
  
  constructEndpoint: function(url, params) {
    var parts = url.split('?'),
        path  = parts.shift(),
        query = parts.join('?'),
    
        pairs = query ? query.split('&') : [],
        n     = pairs.length,
        data  = {};
    
    while (n--) {
      parts = pairs[n].split('=');
      data[decodeURIComponent(parts[0] || '')] = decodeURIComponent(parts[1] || '');
    }
    Faye.extend(data, params);
    
    pairs = [];
    for (var key in data)
      pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
    
    return {
      path:         path,
      queryString:  pairs.join('&')
    };
  },
  
  Request: Faye.Class({
    initialize: function(method, url, params, callbacks, scope) {
      this._method    = method.toUpperCase();
      this._endpoint  = Faye.XHR.constructEndpoint(url, params);
      this._callbacks = (typeof callbacks === 'function') ? {success: callbacks} : callbacks;
      this._scope     = scope || null;
      this._xhr       = null;
    },
    
    send: function() {
      if (this._waiting) return;
      
      var path = this._endpoint.path, qs = this._endpoint.queryString;
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
        
        self._waiting = false;
        self._handleResponse();
        self = null;
      };
      
      var poll = setInterval(handleState, 10);
      this._xhr.send(body);
      
      Faye.Event.on(window, 'unload', function() {
        this._xhr.abort();
      }, this);
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

