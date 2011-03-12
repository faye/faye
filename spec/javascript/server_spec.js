JS.ENV.ServerSpec = JS.Test.describe("Server", function() { with(this) {
  before(function() { with(this) {
    this.engine = {}
    stub(engine, "addSubscriber")
    stub(Faye.Engine, "get").returns(engine)
    this.server = new Faye.Server()
  }})
  
  it("listens for notifications from Engine", function() { with(this) {
    expect(engine, "addSubscriber").given("message", instanceOf(Function), instanceOf(Faye.Server))
    expect(engine, "addSubscriber").given("disconnect", instanceOf(Function), instanceOf(Faye.Server))
    new Faye.Server()
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
              supportedConnectionTypes: ["long-polling", "callback-polling", "websocket"],
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
                supportedConnectionTypes: ["long-polling", "callback-polling", "websocket"],
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
              supportedConnectionTypes: ["long-polling", "callback-polling", "websocket"]
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
              supportedConnectionTypes: ["long-polling", "callback-polling", "websocket"]
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
              supportedConnectionTypes: ["long-polling", "callback-polling", "websocket"]
            }, response)
        })
      }})
    }})
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
        expect(engine, "clientExists").given(clientId).yielding([true])
      }})
      
      it("pings the engine to say the client is active", function() { with(this) {
        expect(engine, "ping").given(clientId)
        server.connect(message, false, function() {})
      }})
      
      it("returns a successful response", function() { with(this) {
        stub(engine, "ping")
        server.connect(message, false, function(response) {
          assertEqual({
              channel:    "/meta/connect",
              successful: true,
              clientId:   clientId
            }, response)
        })
      }})
      
      describe("with a message id", function() { with(this) {
        before(function() { this.message.id = "foo" })
        
        it("returns the same id", function() { with(this) {
          stub(engine, "ping")
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
      
      it("does not ping the engine", function() { with(this) {
        expect(engine, "ping").exactly(0)
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
      
      it("does not ping the engine", function() { with(this) {
        expect(engine, "ping").exactly(0)
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
      
      it("does not ping the engine", function() { with(this) {
        expect(engine, "ping").exactly(0)
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
    
    // TODO fail if connectionType is not recognized
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
              subscription: ["/foo"]
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
        
        it("creates multiple subscriptions", function() { with(this) {
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
                subscription: ["/foo/**"]
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
              subscription: ["/foo"]
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
              subscription: ["/foo"]
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
              subscription: ["foo"]
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
              subscription: ["/meta/foo"]
            }, response)
        })
      }})
    }})
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
              subscription: ["/foo"]
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
        
        it("destroys multiple subscriptions", function() { with(this) {
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
                subscription: ["/foo/**"]
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
              subscription: ["/foo"]
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
              subscription: ["/foo"]
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
              subscription: ["foo"]
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
              subscription: ["/meta/foo"]
            }, response)
        })
      }})
    }})
  }})
}})
