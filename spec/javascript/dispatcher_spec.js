JS.ENV.DispatcherSpec = JS.Test.describe("Dispatcher", function() { with(this) {
  include(JS.Test.FakeClock)

  before(function() { with(this) {
    this.client    = {}
    this.endpoint  = "http://localhost/"
    this.transport = {endpoint: Faye.URI.parse(endpoint), connectionType: "long-polling"}

    stub(client, "trigger")
    stub(Faye.Transport, "get").yields([transport])

    this.dispatcher = new Faye.Dispatcher(client, endpoint, options())

    clock.stub()
  }})

  after(function() { with(this) {
    clock.reset()
  }})

  define("options", function() {
    return {}
  })

  describe("endpointFor", function() { with(this) {
    define("options", function() {
      return {
        endpoints: {websocket: "http://sockets/"}
      }
    })

    it("returns the main endpoint for unspecified connection types", function() { with(this) {
      assertEqual( "http://localhost/", dispatcher.endpointFor("long-polling").href )
    }})

    it("returns an alternate endpoint where specified", function() { with(this) {
      assertEqual( "http://sockets/", dispatcher.endpointFor("websocket").href )
    }})
  }})

  describe("selectTransport", function() { with(this) {
    before(function() { with(this) {
      this.connectionTypes = ["long-polling", "callback-polling", "websocket"]
    }})

    it("asks Transport to select one of the given transports", function() { with(this) {
      expect(Faye.Transport, "get").given(dispatcher, connectionTypes, []).yields([transport])
      dispatcher.selectTransport(connectionTypes)
    }})

    it("asks Transport not to select disabled transports", function() { with(this) {
      dispatcher.disable("websocket")
      expect(Faye.Transport, "get").given(dispatcher, connectionTypes, ["websocket"]).yields([transport])
      dispatcher.selectTransport(connectionTypes)
    }})

    it("sets connectionType on the dispatcher", function() { with(this) {
      transport.connectionType = "transport-connection-type"
      dispatcher.selectTransport(connectionTypes)
      assertEqual( "transport-connection-type", dispatcher.connectionType )
    }})

    it("closes the existing transport if a new one is selected", function() { with(this) {
      var oldTransport = {endpoint: Faye.URI.parse(endpoint)}
      stub(Faye.Transport, "get").given(dispatcher, ["long-polling"], []).yields([oldTransport])
      dispatcher.selectTransport(["long-polling"])

      expect(oldTransport, "close").exactly(1)
      dispatcher.selectTransport(connectionTypes)
    }})

    it("does not close the existing transport if the same one is selected", function() { with(this) {
      dispatcher.selectTransport(["long-polling"])

      expect(transport, "close").exactly(0)
      dispatcher.selectTransport(connectionTypes)
    }})
  }})

  describe("messaging", function() { with(this) {
    before(function() { with(this) {
      this.message    = {id: 1}
      this.request    = {}
      this.reqPromise = Faye.Promise.fulfilled(request)

      stub(transport, "close")
      stub(transport, "sendMessage").returns(reqPromise)

      dispatcher.selectTransport([])
    }})

    describe("sendMessage", function() { with(this) {
      it("does not send a message to the transport if closed", function() { with(this) {
        dispatcher.close()
        expect(transport, "sendMessage").exactly(0)
        dispatcher.sendMessage(message, 25)
      }})

      it("sends a message to the transport", function() { with(this) {
        expect(transport, "sendMessage").given({id: 1}).exactly(1).returning(reqPromise)
        dispatcher.sendMessage(message, 25)
      }})

      it("sends several different messages to the transport", function() { with(this) {
        expect(transport, "sendMessage").given({id: 1}).exactly(1).returning(reqPromise)
        expect(transport, "sendMessage").given({id: 2}).exactly(1).returning(reqPromise)
        dispatcher.sendMessage({id: 1}, 25)
        dispatcher.sendMessage({id: 2}, 25)
      }})

      it("does not resend a message if it's already being sent", function() { with(this) {
        expect(transport, "sendMessage").given({id: 1}).exactly(1).returning(reqPromise)
        dispatcher.sendMessage(message, 25)
        dispatcher.sendMessage(message, 25)
      }})

      it("sets a timeout to fail the message", function() { with(this) {
        dispatcher.sendMessage(message, 25)
        expect(dispatcher, "handleError").given({id: 1}).exactly(1)
        clock.tick(25000)
      }})
    }})

    describe("handleError", function() { with(this) {
      before(function() { with(this) {
        dispatcher.sendMessage(message, 25)
      }})

      it("does not try to resend messagess immediately", function() { with(this) {
        expect(transport, "sendMessage").exactly(0)
        dispatcher.handleError(message)
      }})

      it("resends messages immediately if instructed", function() { with(this) {
        expect(transport, "sendMessage").given({id: 1}).exactly(1).returning(reqPromise)
        dispatcher.handleError(message, true)
      }})

      it("resends a message automatically after a timeout on error", function() { with(this) {
        dispatcher.handleError(message)
        expect(transport, "sendMessage").given({id: 1}).exactly(1).returning(reqPromise)
        clock.tick(5500)
      }})

      it("does not resend a message with an ID it does not recognize", function() { with(this) {
        dispatcher.handleError({id: 2})
        expect(transport, "sendMessage").exactly(0)
        clock.tick(5500)
      }})

      it("does not resend a message if it's waiting to resend", function() { with(this) {
        dispatcher.handleError(message)
        expect(transport, "sendMessage").exactly(0)
        clock.tick(2500)
        dispatcher.sendMessage(message, 25)
      }})

      it("does not schedule another resend if an error is reported while waiting to resend", function() { with(this) {
        expect(transport, "sendMessage").given({id: 1}).exactly(1)
        dispatcher.handleError(message)
        clock.tick(2500)
        dispatcher.handleError(message)
        clock.tick(5500)
      }})

      it("does not schedule a resend if the number of attempts has been exhausted", function() { with(this) {
        expect(transport, "sendMessage").given({id: 2}).exactly(2).returning(reqPromise)
        dispatcher.sendMessage({id: 2}, 25, {attempts: 2})
        dispatcher.handleError({id: 2}, true)
        dispatcher.handleError({id: 2}, true)
      }})

      it("does not count down attempts when an error is reported while waiting to resend", function() { with(this) {
        dispatcher.sendMessage({id: 2}, 25, {attempts: 3})
        dispatcher.handleError({id: 2})
        clock.tick(2500)
        dispatcher.handleError({id: 2}, true)
        clock.tick(5000)
        expect(transport, "sendMessage").given({id: 2}).exactly(1).returning(reqPromise)
        dispatcher.handleError({id: 2}, true)
      }})

      it("does not schedule a resend if the deadline has been reached", function() { with(this) {
        dispatcher.handleResponse({id: 1, successful: true})
        dispatcher.sendMessage({id: 2}, 25, {deadline: 60})
        expect(transport, "sendMessage").given({id: 2}).exactly(2).returning(reqPromise)
        clock.tick(90000)
      }})

      it("emits the transport:down event via the client", function() { with(this) {
        expect(client, "trigger").given("transport:down").exactly(1)
        dispatcher.handleError(message)
      }})

      it("only emits transport:down once, when the first error is received", function() { with(this) {
        dispatcher.sendMessage({id: 2}, 25)
        expect(client, "trigger").given("transport:down").exactly(1)
        dispatcher.handleError({id: 1})
        dispatcher.handleError({id: 2})
      }})

      it("emits transport:down again if there was a message since the last event", function() { with(this) {
        dispatcher.sendMessage({id: 2}, 25)
        expect(client, "trigger").given("transport:down").exactly(2)
        dispatcher.handleError({id: 1})
        dispatcher.handleResponse({id: 3})
        dispatcher.handleError({id: 2})
      }})
    }})

    describe("handleResponse", function() { with(this) {
      before(function() { with(this) {
        dispatcher.sendMessage(message, 25)
      }})

      it("clears the timeout to resend the message if successful=true", function() { with(this) {
        expect(dispatcher, "handleError").exactly(0)
        dispatcher.handleResponse({id: 1, successful: true})
        clock.tick(25000)
      }})

      it("clears the timeout to resend the message if successful=false", function() { with(this) {
        expect(dispatcher, "handleError").exactly(0)
        dispatcher.handleResponse({id: 1, successful: false})
        clock.tick(25000)
      }})

      it("leaves the timeout to resend the message if successful is missing", function() { with(this) {
        expect(dispatcher, "handleError").given({id: 1}).exactly(1)
        dispatcher.handleResponse(message)
        clock.tick(25000)
      }})

      it("emits the message as an event", function() { with(this) {
        expect(dispatcher, "trigger").given("message", {id: 3}).exactly(1)
        dispatcher.handleResponse({id: 3})
      }})

      it("emits the transport:up event via the client", function() { with(this) {
        expect(client, "trigger").given("transport:up").exactly(1)
        dispatcher.handleResponse(message)
      }})

      it("only emits transport:up once, when the first message is received", function() { with(this) {
        expect(client, "trigger").given("transport:up").exactly(1)
        dispatcher.handleResponse({id: 1})
        dispatcher.handleResponse({id: 2})
      }})

      it("emits transport:up again if there was an error since the last event", function() { with(this) {
        expect(client, "trigger").given("transport:up").exactly(2)
        dispatcher.handleResponse({id: 2})
        dispatcher.handleError({id: 1})
        dispatcher.handleResponse({id: 3})
      }})
    }})
  }})
}})
