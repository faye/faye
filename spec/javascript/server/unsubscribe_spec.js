JS.ENV.Server.UnsubscribeSpec = JS.Test.describe("Server unsubscribe", function() { with(this) {
  before(function() { with(this) {
    this.engine = {}
    stub(Faye.Engine, "get").returns(engine)
    this.server = new Faye.Server()
  }})

  describe("#unsubscribe", function() { with(this) {
    before(function() { with(this) {
      this.clientId = "fakeclientid"
      this.message = {channel: "/meta/unsubscribe",
                      clientId: "fakeclientid",
                      subscription: "/foo"}
    }})

    describe("with valid parameters", function() { with(this) {
      before(function() { with(this) {
        expect(engine, "clientExists").given(clientId).yielding([true])
      }})

      it("unsubscribes the client from the channel", function() { with(this) {
        expect(engine, "unsubscribe").given(clientId, "/foo")
        server.unsubscribe(message, false, function() {})
      }})

      it("returns a successful response", function() { with(this) {
        stub(engine, "unsubscribe")
        server.unsubscribe(message, false, function(response) {
          assertEqual({
              channel:      "/meta/unsubscribe",
              successful:   true,
              clientId:     clientId,
              subscription: "/foo"
            }, response)
        })
      }})

      describe("with a list of subscriptions", function() { with(this) {
        before(function() { with(this) {
          message.subscription = ["/foo", "/bar"]
        }})

        it("destroys multiple subscriptions", function() { with(this) {
          expect(engine, "unsubscribe").given(clientId, "/foo")
          expect(engine, "unsubscribe").given(clientId, "/bar")
          server.unsubscribe(message, false, function() {})
        }})

        it("returns a successful response", function() { with(this) {
          stub(engine, "unsubscribe")
          server.unsubscribe(message, false, function(response) {
            assertEqual({
                channel:      "/meta/unsubscribe",
                successful:   true,
                clientId:     clientId,
                subscription: ["/foo", "/bar"]
              }, response)
          })
        }})
      }})

      describe("with a subscription pattern", function() { with(this) {
        before(function() { with(this) {
          message.subscription = "/foo/**"
        }})

        it("destroys the subscription to the channel pattern", function() { with(this) {
          expect(engine, "unsubscribe").given(clientId, "/foo/**")
          server.unsubscribe(message, false, function() {})
        }})

        it("returns a successful response", function() { with(this) {
          stub(engine, "unsubscribe")
          server.unsubscribe(message, false, function(response) {
            assertEqual({
                channel:      "/meta/unsubscribe",
                successful:   true,
                clientId:     clientId,
                subscription: "/foo/**"
              }, response)
          })
        }})
      }})
    }})

    describe("with an unknown client", function() { with(this) {
      before(function() { with(this) {
        expect(engine, "clientExists").given(clientId).yielding([false])
      }})

      it("does not unsubscribe the client from the channel", function() { with(this) {
        expect(engine, "unsubscribe").exactly(0)
        server.unsubscribe(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        server.unsubscribe(message, false, function(response) {
          assertEqual({
              channel:      "/meta/unsubscribe",
              successful:   false,
              error:        "401:fakeclientid:Unknown client",
              clientId:     clientId,
              subscription: "/foo"
            }, response)
        })
      }})
    }})

    describe("missing clientId", function() { with(this) {
      before(function() { with(this) {
        delete message.clientId
        expect(engine, "clientExists").given(undefined).yielding([false])
      }})

      it("does not unsubscribe the client from the channel", function() { with(this) {
        expect(engine, "unsubscribe").exactly(0)
        server.unsubscribe(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        server.unsubscribe(message, false, function(response) {
          assertEqual({
              channel:      "/meta/unsubscribe",
              successful:   false,
              error:        "402:clientId:Missing required parameter",
              subscription: "/foo"
            }, response)
        })
      }})
    }})

    describe("missing subscription", function() { with(this) {
      before(function() { with(this) {
        delete message.subscription
        expect(engine, "clientExists").given(clientId).yielding([true])
      }})

      it("does not unsubscribe the client from the channel", function() { with(this) {
        expect(engine, "unsubscribe").exactly(0)
        server.unsubscribe(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        server.unsubscribe(message, false, function(response) {
          assertEqual({
              channel:      "/meta/unsubscribe",
              successful:   false,
              error:        "402:subscription:Missing required parameter",
              clientId:     clientId,
              subscription: []
            }, response)
        })
      }})
    }})

    describe("with an invalid channel", function() { with(this) {
      before(function() { with(this) {
        message.subscription = "foo"
        expect(engine, "clientExists").given(clientId).yielding([true])
      }})

      it("does not unsubscribe the client from the channel", function() { with(this) {
        expect(engine, "unsubscribe").exactly(0)
        server.unsubscribe(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        server.unsubscribe(message, false, function(response) {
          assertEqual({
              channel:      "/meta/unsubscribe",
              successful:   false,
              error:        "405:foo:Invalid channel",
              clientId:     clientId,
              subscription: "foo"
            }, response)
        })
      }})
    }})

    describe("with a /meta/* channel", function() { with(this) {
      before(function() { with(this) {
        message.subscription = "/meta/foo"
        expect(engine, "clientExists").given(clientId).yielding([true])
      }})

      it("does not unsubscribe the client from the channel", function() { with(this) {
        expect(engine, "unsubscribe").exactly(0)
        server.unsubscribe(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        server.unsubscribe(message, false, function(response) {
          assertEqual({
              channel:      "/meta/unsubscribe",
              successful:   false,
              error:        "403:/meta/foo:Forbidden channel",
              clientId:     clientId,
              subscription: "/meta/foo"
            }, response)
        })
      }})

      it("unsubscribes local clients from the channel", function() { with(this) {
        expect(engine, "unsubscribe").given(clientId, "/meta/foo")
        server.unsubscribe(message, true, function() {})
      }})

      it("returns a successful response for local clients", function() { with(this) {
        stub(engine, "unsubscribe")
        server.unsubscribe(message, true, function(response) {
          assertEqual({
              channel:      "/meta/unsubscribe",
              successful:   true,
              clientId:     clientId,
              subscription: "/meta/foo"
            }, response)
        })
      }})
    }})

    describe("with an error", function() { with(this) {
      before(function() { with(this) {
        message.error = "invalid"
        expect(engine, "clientExists").given(clientId).yielding([true])
      }})

      it("does not unsubscribe the client from the channel", function() { with(this) {
        expect(engine, "unsubscribe").exactly(0)
        server.unsubscribe(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        server.unsubscribe(message, false, function(response) {
          assertEqual({
              channel:      "/meta/unsubscribe",
              successful:   false,
              error:        "invalid",
              clientId:     clientId,
              subscription: "/foo"
            }, response)
        })
      }})
    }})
  }})
}})
