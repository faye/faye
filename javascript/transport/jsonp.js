Faye.Transport.JSONP = Faye.extend(Faye.Class(Faye.Transport, {
  shouldFlush: function(messages) {
    var params = {
      message:  Faye.toJSON(messages),
      jsonp:    '__jsonp' + Faye.Transport.JSONP._cbCount + '__'
    };
    var location = Faye.URI.parse(this._endpoint, params).toURL();
    return location.length >= Faye.Transport.MAX_URL_LENGTH;
  },
  
  request: function(messages, timeout) {
    var params       = {message: Faye.toJSON(messages)},
        head         = document.getElementsByTagName('head')[0],
        script       = document.createElement('script'),
        callbackName = Faye.Transport.JSONP.getCallbackName(),
        location     = Faye.URI.parse(this._endpoint, params),
        retry        = this.retry(messages, timeout),
        self         = this;
    
    Faye.ENV[callbackName] = function(data) {
      cleanUp();
      self.receive(data);
      self.trigger('up');
    };
    
    var timer = Faye.ENV.setTimeout(function() {
      cleanUp();
      retry();
      self.trigger('down');
    }, 1.5 * 1000 * timeout);
    
    var cleanUp = function() {
      if (!Faye.ENV[callbackName]) return false;
      Faye.ENV[callbackName] = undefined;
      try { delete Faye.ENV[callbackName] } catch (e) {}
      Faye.ENV.clearTimeout(timer);
      script.parentNode.removeChild(script);
      return true;
    };
    
    location.params.jsonp = callbackName;
    script.type = 'text/javascript';
    script.src  = location.toURL();
    head.appendChild(script);
  }
}), {
  _cbCount: 0,
  
  getCallbackName: function() {
    this._cbCount += 1;
    return '__jsonp' + this._cbCount + '__';
  },
  
  isUsable: function(endpoint, callback, context) {
    callback.call(context, true);
  }
});

Faye.Transport.register('callback-polling', Faye.Transport.JSONP);
