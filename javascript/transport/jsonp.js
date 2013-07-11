Faye.Transport.JSONP = Faye.extend(Faye.Class(Faye.Transport, {
  shouldFlush: function(messages) {
    var endpoint = Faye.copyObject(this.endpoint);
    endpoint.query.message = Faye.toJSON(messages);
    endpoint.query.jsonp   = '__jsonp' + Faye.Transport.JSONP._cbCount + '__';
    var url = Faye.URI.stringify(endpoint);
    return url.length >= Faye.Transport.MAX_URL_LENGTH;
  },

  request: function(messages, timeout) {
    var head         = document.getElementsByTagName('head')[0],
        script       = document.createElement('script'),
        callbackName = Faye.Transport.JSONP.getCallbackName(),
        endpoint     = Faye.copyObject(this.endpoint),
        retry        = this.retry(messages, timeout),
        self         = this;

    endpoint.query.message = Faye.toJSON(messages);
    endpoint.query.jsonp   = callbackName;

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

    script.type = 'text/javascript';
    script.src  = Faye.URI.stringify(endpoint);
    head.appendChild(script);
  }
}), {
  _cbCount: 0,

  getCallbackName: function() {
    this._cbCount += 1;
    return '__jsonp' + this._cbCount + '__';
  },

  isUsable: function(client, endpoint, callback, context) {
    callback.call(context, true);
  }
});

Faye.Transport.register('callback-polling', Faye.Transport.JSONP);
