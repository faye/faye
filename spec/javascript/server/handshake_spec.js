var jstest = require("jstest").Test

var Engine = require("../../../javascript/engines/proxy"),
    Server = require("../../../javascript/protocol/server")

jstest.describe("Server handshake", function() { with(this) {
  before(function() { with(this) {
    this.engine = {}
    stub(Engine, "get").returns(engine)
    this.server = new Server()

    this.connectionTypes = ["long-polling", "cross-origin-long-polling",
                            "callback-polling","websocket",
                            "eventsource","in-process"]
  }})

  describe("#handshake", function() { with(this) {
    before(function() { with(this) {
      this.message = {channel: "/meta/handshake",
                      version: "1.0",
                      supportedConnectionTypes: ["long-polling"]}
    }})

    describe("with valid parameters", function() { with(this) {
      it("creates a client", function() { with(this) {
        expect(engine, "createClient")
        server.handshake(message, false, function() {})
      }})

      it("returns a successful response", function() { with(this) {
        stub(engine, "createClient").yields(["clientid"])
        server.handshake(message, false, function(response) {
          assertEqual({
              channel:    "/meta/handshake",
              successful: true,
              version:    "1.0",
              supportedConnectionTypes: connectionTypes,
              clientId:   "clientid"
            }, response)
        })
      }})

      describe("with a message id", function() { with(this) {
        before(function() { this.message.id = "foo" })

        it("returns the same id", function() { with(this) {
          stub(engine, "createClient").yields(["clientid"])
          server.handshake(message, false, function(response) {
            assertEqual({
                channel:    "/meta/handshake",
                successful: true,
                version:    "1.0",
                supportedConnectionTypes: connectionTypes,
                clientId:   "clientid",
                id:         "foo"
              }, response)
          })
        }})
      }})
    }})

    describe("missing version", function() { with(this) {
      before(function() { delete this.message.version })

      it("does not create a client", function() { with(this) {
        expect(engine, "createClient").exactly(0)
        server.handshake(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        server.handshake(message, false, function(response) {
          assertEqual({
              channel:    "/meta/handshake",
              successful: false,
              error:      "402:version:Missing required parameter",
              version:    "1.0",
              supportedConnectionTypes: connectionTypes
            }, response)
        })
      }})
    }})

    describe("missing supportedConnectionTypes", function() { with(this) {
      before(function() { delete this.message.supportedConnectionTypes })

      it("does not create a client", function() { with(this) {
        expect(engine, "createClient").exactly(0)
        server.handshake(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        server.handshake(message, false, function(response) {
          assertEqual({
              channel:    "/meta/handshake",
              successful: false,
              error:      "402:supportedConnectionTypes:Missing required parameter",
              version:    "1.0",
              supportedConnectionTypes: connectionTypes
            }, response)
        })
      }})
    }})

    describe("with no matching supportedConnectionTypes", function() { with(this) {
      before(function() { with(this) {
        message.supportedConnectionTypes = ["iframe", "flash"]
      }})

      it("does not create a client", function() { with(this) {
        expect(engine, "createClient").exactly(0)
        server.handshake(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        server.handshake(message, false, function(response) {
          assertEqual({
              channel:    "/meta/handshake",
              successful: false,
              error:      "301:iframe,flash:Connection types not supported",
              version:    "1.0",
              supportedConnectionTypes: connectionTypes
            }, response)
        })
      }})
    }})

    describe("with an error", function() { with(this) {
      before(function() { with(this) {
        message.error = "invalid"
      }})

      it("does not create a client", function() { with(this) {
        expect(engine, "createClient").exactly(0)
        server.handshake(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        server.handshake(message, false, function(response) {
          assertEqual({
              channel:    "/meta/handshake",
              successful: false,
              error:      "invalid",
              version:    "1.0",
              supportedConnectionTypes: connectionTypes
            }, response)
        })
      }})
    }})
  }})
}})
