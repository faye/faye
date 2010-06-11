Faye.Subscription = Faye.Class({
  initialize: function(client, channels, callback, scope) {
    this._client    = client;
    this._channels  = channels;
    this._callback  = callback;
    this._scope     = scope;
    this._cancelled = false;
  },
  
  cancel: function() {
    if (this._cancelled) return;
    this._client.unsubscribe(this._channels, this._callback, this._scope);
    this._cancelled = true;
  },
  
  unsubscribe: function() {
    this.cancel();
  }
});

