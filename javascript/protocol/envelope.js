Faye.Envelope = Faye.Class({
  initialize: function(message, timeout) {
    this.id      = message.id;
    this.message = message;

    if (timeout !== undefined) this.timeout(timeout / 1000, false);
  }
});

Faye.extend(Faye.Envelope.prototype, Faye.Deferrable);
