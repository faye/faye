var jstest = require("jstest").Test

var Engine = require("../../../javascript/engines/proxy"),
    Server = require("../../../javascript/protocol/server")

jstest.describe("Server connect", function() { with(this) {
  before(function() { with(this) {
    this.engine = {}
    stub(Engine, "get").returns(engine)
    this.server = new Server()
  }})

  describe("#connect", function() { with(this) {
    before(function() { with(this) {
      this.clientId = "fakeclientid"
      this.message = {channel:  "/meta/connect",
                      clientId: "fakeclientid",
                      connectionType: "long-polling"}
    }})

    describe("with valid parameters", function() { with(this) {
      before(function() { with(this) {
        message.advice = {timeout: 60}
        expect(engine, "clientExists").given(clientId).yielding([true])
      }})

      it("connects to the engine to wait for new messages", function() { with(this) {
        expect(engine, "connect").given(clientId, {timeout: 60}).yielding([[]])
        server.connect(message, false, function() {})
      }})

      it("returns a successful response and any queued messages", function() { with(this) {
        stub(engine, "connect").yields([{channel: "/x", data: "hello"}])
        server.connect(message, false, function(response) {
          assertEqual([
            { channel:    "/meta/connect",
              successful: true,
              clientId:   clientId
            },
            { channel: "/x",
              data:    "hello"
            }
          ], response)
        })
      }})

      describe("with a message id", function() { with(this) {
        before(function() { this.message.id = "foo" })

        it("returns the same id", function() { with(this) {
          stub(engine, "connect")
          server.connect(message, false, function(response) {
            assertEqual({
                channel:    "/meta/connect",
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

      it("does not connect to the engine", function() { with(this) {
        expect(engine, "connect").exactly(0)
        server.connect(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        server.connect(message, false, function(response) {
          assertEqual({
              channel:    "/meta/connect",
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

      it("does not connect to the engine", function() { with(this) {
        expect(engine, "connect").exactly(0)
        server.connect(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        server.connect(message, false, function(response) {
          assertEqual({
              channel:    "/meta/connect",
              successful: false,
              error:      "402:clientId:Missing required parameter"
            }, response)
        })
      }})
    }})

    describe("missing connectionType", function() { with(this) {
      before(function() { with(this) {
        delete message.connectionType
        expect(engine, "clientExists").given(clientId).yielding([true])
      }})

      it("does not connect to the engine", function() { with(this) {
        expect(engine, "connect").exactly(0)
        server.connect(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        server.connect(message, false, function(response) {
          assertEqual({
              channel:    "/meta/connect",
              successful: false,
              error:      "402:connectionType:Missing required parameter"
            }, response)
        })
      }})
    }})

    describe("with an unknown connectionType", function() { with(this) {
      before(function() { with(this) {
        message.connectionType = "flash"
        expect(engine, "clientExists").given(clientId).yielding([true])
      }})

      it("does not connect to the engine", function() { with(this) {
        expect(engine, "connect").exactly(0)
        server.connect(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        server.connect(message, false, function(response) {
          assertEqual({
              channel:    "/meta/connect",
              successful: false,
              error:      "301:flash:Connection types not supported"
            }, response)
        })
      }})
    }})

    describe("with an error", function() { with(this) {
      before(function() { with(this) {
        message.error = "invalid"
        expect(engine, "clientExists").given(clientId).yielding([true])
      }})

      it("does not connect to the engine", function() { with(this) {
        expect(engine, "connect").exactly(0)
        server.connect(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        server.connect(message, false, function(response) {
          assertEqual({
              channel:    "/meta/connect",
              successful: false,
              error:      "invalid"
            }, response)
        })
      }})
    }})
  }})
}})
