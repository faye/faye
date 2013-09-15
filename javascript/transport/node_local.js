Faye.Transport.NodeLocal = Faye.extend(Faye.Class(Faye.Transport, {
  batching: false,

  request: function(envelopes) {
    var messages = Faye.map(envelopes, function(e) { return e.message });
    messages = Faye.copyObject(messages);
    this.endpoint.process(messages, null, function(responses) {
      this.receive(envelopes, Faye.copyObject(responses));
    }, this);
  }
}), {
  isUsable: function(client, endpoint, callback, context) {
    callback.call(context, endpoint instanceof Faye.Server);
  }
});

Faye.Transport.register('in-process', Faye.Transport.NodeLocal);
