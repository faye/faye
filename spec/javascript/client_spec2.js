// I had to create a new client_spec test file because of this bug:
// https://github.com/faye/faye/issues/406
JS.ENV.ClientSpec2 = JS.Test.describe("Client", function() { with(this) {
  before(function() { with(this) {
    this.dispatcher = {connectionType: "fake-transport", retry: 5};
    stub(dispatcher, "getConnectionTypes").returns(["fake-transport", "another-transport"]);
    stub(dispatcher, "selectTransport");
    stub(dispatcher, "sendMessage");
    Faye.extend(dispatcher, Faye.Publisher);
    stub("new", Faye, "Dispatcher").returns(dispatcher);
  }});

  define("createClient", function() { with(this) {
    this.client = new Faye.Client("http://localhost/")
  }});

  describe("request", function() { with(this) {
    before(function() { with(this) {
      createClient();
      stub(dispatcher, "sendMessage", function(message, timeout, options) {
        var response = {
          id: message.id,
          clientId:   message.clientId,
          channel:    message.channel,
          successful: true
        };
        if (message.channel === '/meta/handshake') {
          response.version = "1.0";
          response.supportedConnectionTypes = ["fake-transport"];
          dispatcher.trigger("message", response);
        } else if (message.channel === '/meta/connect') {
          dispatcher.trigger("message", response);
        } else if (/^\/service\//.test(message.channel)) {
          response.data = { fake_response: 'ok' };
          dispatcher.trigger("message", response);
        } else {
          ;
        }
        return
      });
    }});

    it("sends a request to the server that gets a response", function(resume) { with(this) {
      client.request("/service/foo", {hello: "world"}).then(function(response) {
        assertEqual('ok', response && response.data && response.data.fake_response, 'request should get a response');
        resume();
      }, resume);
    }});
  }})
}});
