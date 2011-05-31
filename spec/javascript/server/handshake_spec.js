JS.ENV.Server.HandshakeSpec = JS.Test.describe("Server handshake", function() { with(this) {
  before(function() { with(this) {
    this.engine = {}
    stub(Faye.Engine, "get").returns(engine)
    this.server = new Faye.Server()
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
              supportedConnectionTypes: ["long-polling", "cross-origin-long-polling", "callback-polling", "websocket","in-process"],
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
                supportedConnectionTypes: ["long-polling", "cross-origin-long-polling", "callback-polling", "websocket","in-process"],
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
              supportedConnectionTypes: ["long-polling", "cross-origin-long-polling", "callback-polling", "websocket","in-process"]
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
              supportedConnectionTypes: ["long-polling", "cross-origin-long-polling", "callback-polling", "websocket","in-process"]
            }, response)
        })
      }})
      
      it("returns a successful response for local clients", function() { with(this) {
        expect(engine, "createClient").yields(["clientid"])
        server.handshake(message, true, function(response) {
          assertEqual({
              channel:    "/meta/handshake",
              successful: true,
              version:    "1.0",
              clientId:   "clientid"
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
              supportedConnectionTypes: ["long-polling", "cross-origin-long-polling", "callback-polling", "websocket","in-process"]
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
              supportedConnectionTypes: ["long-polling", "cross-origin-long-polling", "callback-polling", "websocket","in-process"]
            }, response)
        })
      }})
    }})
  }})
}})
