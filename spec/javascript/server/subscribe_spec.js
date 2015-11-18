var jstest = require("jstest").Test

var Engine = require("../../../javascript/engines/proxy"),
    Server = require("../../../javascript/protocol/server")

jstest.describe("Server subscribe", function() { with(this) {
  before(function() { with(this) {
    this.engine = {}
    stub(Engine, "get").returns(engine)
    this.server = new Server()
  }})

  describe("#subscribe", function() { with(this) {
    before(function() { with(this) {
      this.clientId = "fakeclientid"
      this.message = {channel: "/meta/subscribe",
                      clientId: "fakeclientid",
                      subscription: "/foo"}
    }})

    describe("with valid parameters", function() { with(this) {
      before(function() { with(this) {
        expect(engine, "clientExists").given(clientId).yielding([true])
      }})

      it("subscribes the client to the channel", function() { with(this) {
        expect(engine, "subscribe").given(clientId, "/foo")
        server.subscribe(message, false, function() {})
      }})

      it("returns a successful response", function() { with(this) {
        stub(engine, "subscribe")
        server.subscribe(message, false, function(response) {
          assertEqual({
              channel:      "/meta/subscribe",
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

        it("creates multiple subscriptions", function() { with(this) {
          expect(engine, "subscribe").given(clientId, "/foo")
          expect(engine, "subscribe").given(clientId, "/bar")
          server.subscribe(message, false, function() {})
        }})

        it("returns a successful response", function() { with(this) {
          stub(engine, "subscribe")
          server.subscribe(message, false, function(response) {
            assertEqual({
                channel:      "/meta/subscribe",
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

        it("subscribes the client to the channel pattern", function() { with(this) {
          expect(engine, "subscribe").given(clientId, "/foo/**")
          server.subscribe(message, false, function() {})
        }})

        it("returns a successful response", function() { with(this) {
          stub(engine, "subscribe")
          server.subscribe(message, false, function(response) {
            assertEqual({
                channel:      "/meta/subscribe",
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

      it("does not subscribe the client to the channel", function() { with(this) {
        expect(engine, "subscribe").exactly(0)
        server.subscribe(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        server.subscribe(message, false, function(response) {
          assertEqual({
              channel:      "/meta/subscribe",
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

      it("does not subscribe the client to the channel", function() { with(this) {
        expect(engine, "subscribe").exactly(0)
        server.subscribe(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        server.subscribe(message, false, function(response) {
          assertEqual({
              channel:      "/meta/subscribe",
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

      it("does not subscribe the client to the channel", function() { with(this) {
        expect(engine, "subscribe").exactly(0)
        server.subscribe(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        server.subscribe(message, false, function(response) {
          assertEqual({
              channel:      "/meta/subscribe",
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

      it("does not subscribe the client to the channel", function() { with(this) {
        expect(engine, "subscribe").exactly(0)
        server.subscribe(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        server.subscribe(message, false, function(response) {
          assertEqual({
              channel:      "/meta/subscribe",
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

      it("does not subscribe the client to the channel", function() { with(this) {
        expect(engine, "subscribe").exactly(0)
        server.subscribe(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        server.subscribe(message, false, function(response) {
          assertEqual({
              channel:      "/meta/subscribe",
              successful:   false,
              error:        "403:/meta/foo:Forbidden channel",
              clientId:     clientId,
              subscription: "/meta/foo"
            }, response)
        })
      }})

      it("subscribes local clients to the channel", function() { with(this) {
        expect(engine, "subscribe").given(clientId, "/meta/foo")
        server.subscribe(message, true, function() {})
      }})

      it("returns a successful response for local clients", function() { with(this) {
        stub(engine, "subscribe")
        server.subscribe(message, true, function(response) {
          assertEqual({
              channel:      "/meta/subscribe",
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

      it("does not subscribe the client to the channel", function() { with(this) {
        expect(engine, "subscribe").exactly(0)
        server.subscribe(message, false, function() {})
      }})

      it("returns an unsuccessful response", function(resume) { with(this) {
        server.subscribe(message, false, function(response) {
          resume(function() {
            assertEqual({
                channel:      "/meta/subscribe",
                successful:   false,
                error:        "invalid",
                clientId:     clientId,
                subscription: "/foo"
              }, response)
          })
        })
      }})
    }})
  }})
}})
