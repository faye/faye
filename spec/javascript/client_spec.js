JS.ENV.ClientSpec = JS.Test.describe("Client", function() { with(this) {
  before(function() { with(this) {
    this.transport = {connectionType: "fake"}
  }})

  define("createClient", function() { with(this) {
    stub(Faye.Transport, "get").yields([transport])
    this.client = new Faye.Client("http://localhost/")
  }})

  define("stubResponse", function(response) { with(this) {
    stub(transport, "send", function(message) {
      response.id = message.id
      client.receiveMessage(response)
    })
  }})

  describe("initialize", function() { with(this) {
    it("creates a transport the server must support", function() { with(this) {
      expect(Faye.Transport, "get").given(instanceOf(Faye.Client),
                                          ["long-polling", "callback-polling", "in-process"])
                                   .yielding([transport])
      new Faye.Client("http://localhost/")
    }})

    it("puts the client in the UNCONNECTED state", function() { with(this) {
      stub(Faye.Transport, "get")
      var client = new Faye.Client("http://localhost/")
      assertEqual( "UNCONNECTED", client.getState() )
    }})
  }})

  describe("handshake", function() { with(this) {
    before(function() { this.createClient() })

    it("sends a handshake message to the server", function() { with(this) {
      expect(transport, "send").given({
        channel:  "/meta/handshake",
        version:  "1.0",
        supportedConnectionTypes: ["fake"],
        id:       instanceOf("string")
      }, 60)
      client.handshake()
    }})

    it("puts the client in the CONNECTING state", function() { with(this) {
      stub(transport, "send")
      client.handshake()
      assertEqual( "CONNECTING", client.getState() )
    }})

    describe("on successful response", function() { with(this) {
      before(function() { with(this) {
        stubResponse({channel:    "/meta/handshake",
                      successful: true,
                      version:    "1.0",
                      supportedConnectionTypes: ["websocket"],
                      clientId:   "fakeid" })
      }})

      it("stores the clientId", function() { with(this) {
        client.handshake()
        assertEqual( "fakeid", client.getClientId() )
      }})

      it("puts the client in the CONNECTED state", function() { with(this) {
        client.handshake()
        assertEqual( "CONNECTED", client.getState() )
      }})

      it("selects a new transport based on what the server supports", function() { with(this) {
        expect(Faye.Transport, "get").given(instanceOf(Faye.Client), ["websocket"])
                                     .yielding([transport])
        client.handshake()
      }})

      it("registers any pre-existing subscriptions", function() { with(this) {
        expect(client, "subscribe").given([])
        client.handshake()
      }})
    }})

    describe("on unsuccessful response", function() { with(this) {
      before(function() { with(this) {
        stubResponse({channel:    "/meta/handshake",
                      successful: false,
                      version:    "1.0",
                      supportedConnectionTypes: ["websocket"] })
      }})

      it("schedules a retry", function() { with(this) {
        expect("setTimeout")
        client.handshake()
      }})

      it("puts the client in the UNCONNECTED state", function() { with(this) {
        stub("setTimeout")
        client.handshake()
        assertEqual( "UNCONNECTED", client.getState() )
      }})
    }})
  }})
}})
