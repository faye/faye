Faye.Client = Faye.Class({
  initialize: function(endpoint) {
    this._endpoint = endpoint;
  },
  
  // TODO take parameters for authentication
  connect: function() {
    Faye.XHR.request('POST', this._endpoint, {
      message: JSON.stringify({
        channel:    Faye.Channel.HANDSHAKE,
        version:    Faye.BAYEUX_VERSION,
        supportedConnectionTypes: ['long-polling']
      })
    }, function(response) {
      var data = JSON.parse(response.text());
      this._clientId = data[0].clientId;
    }, this);
  }
});

