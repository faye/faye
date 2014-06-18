Faye.Transport.JSONP = Faye.extend(Faye.Class(Faye.Transport, {
 encode: function(envelopes) {
    var messages = Faye.map(envelopes, function(e) { return e.message });
    var url = Faye.copyObject(this.endpoint);
    url.query.message = Faye.toJSON(messages);
    url.query.jsonp   = '__jsonp' + Faye.Transport.JSONP._cbCount + '__';
    return Faye.URI.stringify(url);
  },

  request: function(envelopes) {
    var messages     = Faye.map(envelopes, function(e) { return e.message }),
        head         = document.getElementsByTagName('head')[0],
        script       = document.createElement('script'),
        callbackName = Faye.Transport.JSONP.getCallbackName(),
        endpoint     = Faye.copyObject(this.endpoint),
        self         = this;

    endpoint.query.message = Faye.toJSON(messages);
    endpoint.query.jsonp   = callbackName;

    var cleanup = function() {
      if (!Faye.ENV[callbackName]) return false;
      Faye.ENV[callbackName] = undefined;
      try { delete Faye.ENV[callbackName] } catch (e) {}
      script.parentNode.removeChild(script);
    };

    Faye.ENV[callbackName] = function(data) {
      cleanup();
      self.receive(envelopes, data);
    };

    script.type = 'text/javascript';
    script.src  = Faye.URI.stringify(endpoint);
    script.onerror = function(){
      self._client.trigger('transport:error');
    };
    script.onload = function(){
      self._client.trigger('transport:success');
    };
    head.appendChild(script);

    return {abort: cleanup};
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
