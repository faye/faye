JS.ENV.Server.DisconnectSpec = JS.Test.describe("Server disconnect", function() { with(this) {
  before(function() { with(this) {
    this.engine = {}
    stub(Faye.Engine, "get").returns(engine)
    this.server = new Faye.Server()
  }})

  describe("#disconnect", function() { with(this) {
    before(function() { with(this) {
      this.clientId = "fakeclientid"
      this.message = {channel: "/meta/disconnect",
                      clientId: "fakeclientid"}
    }})

    describe("with valid parameters", function() { with(this) {
      before(function() { with(this) {
        expect(engine, "clientExists").given(clientId).yielding([true])
      }})

      it("destroys the client", function() { with(this) {
        expect(engine, "destroyClient").given(clientId)
        server.disconnect(message, false, function() {})
      }})

      it("returns a successful response", function() { with(this) {
        stub(engine, "destroyClient")
        server.disconnect(message, false, function(response) {
          assertEqual({
              channel:   "/meta/disconnect",
              successful: true,
              clientId:   clientId
            }, response)
        })
      }})

      describe("with a message id", function() { with(this) {
        before(function() { this.message.id = "foo" })

        it("returns the same id", function() { with(this) {
          stub(engine, "destroyClient")
          server.disconnect(message, false, function(response) {
            assertEqual({
              channel:    "/meta/disconnect",
              successful: true,
              clientId:   clientId,
              id:         "foo"
              }, response)
          })
        }})
      }})
    }})

    describe("with an unknown client", function() { with(this) {
      before(function() { with(this) {
        expect(engine, "clientExists").given(clientId).yielding([false])
      }})

      it("does not destroy the client", function() { with(this) {
        expect(engine, "destroyClient").exactly(0)
        server.disconnect(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        stub(engine, "destroyClient")
        server.disconnect(message, false, function(response) {
          assertEqual({
              channel:   "/meta/disconnect",
              successful: false,
              error:      "401:fakeclientid:Unknown client"
            }, response)
        })
      }})
    }})

    describe("missing clientId", function() { with(this) {
      before(function() { with(this) {
        delete message.clientId
        expect(engine, "clientExists").given(undefined).yielding([false])
      }})

      it("does not destroy the client", function() { with(this) {
        expect(engine, "destroyClient").exactly(0)
        server.disconnect(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        stub(engine, "destroyClient")
        server.disconnect(message, false, function(response) {
          assertEqual({
              channel:   "/meta/disconnect",
              successful: false,
              error:      "402:clientId:Missing required parameter"
            }, response)
        })
      }})
    }})

    describe("with an error", function() { with(this) {
      before(function() { with(this) {
        message.error = "invalid"
        expect(engine, "clientExists").given(clientId).yielding([true])
      }})

      it("does not destroy the client", function() { with(this) {
        expect(engine, "destroyClient").exactly(0)
        server.disconnect(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        stub(engine, "destroyClient")
        server.disconnect(message, false, function(response) {
          assertEqual({
              channel:   "/meta/disconnect",
              successful: false,
              error:      "invalid"
            }, response)
        })
      }})
    }})
  }})
}})
