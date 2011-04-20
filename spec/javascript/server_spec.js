JS.ENV.ServerSpec = JS.Test.describe("Server", function() { with(this) {
  before(function() { with(this) {
    this.engine = {}
    stub(Faye.Engine, "get").returns(engine)
    this.server = new Faye.Server()
  }})
  
  describe("#process", function() { with(this) {
    before(function() { with(this) {
      this.handshake   = {channel: "/meta/handshake",   data: "handshake"}
      this.connect     = {channel: "/meta/connect",     data: "connect"}
      this.disconnect  = {channel: "/meta/disconnect",  data: "disconnect"}
      this.subscribe   = {channel: "/meta/subscribe",   data: "subscribe"}
      this.unsubscribe = {channel: "/meta/unsubscribe", data: "unsubscribe"}
      this.publish     = {channel: "/some/channel",     data: "publish"}
      
      stub(engine, "interval", 0)
      stub(engine, "timeout", 60)
    }})
    
    it("returns an empty response for no messages", function() { with(this) {
      var response = null
      server.process([], false, function(r) { response = r})
      assertEqual( [], response )
    }})
    
    it("ignores invalid messages", function() { with(this) {
      var response = null
      server.process([{}, {channel: "invalid"}], false, function(r) { response = r})
      assertEqual( [], response )
    }})
    
    it("routes single messages to appropriate handlers", function() { with(this) {
      expect(server, "handshake").given(handshake, false).yielding([{}])
      expect(engine, "publish").given(handshake)
      server.process(handshake, false, function() {})
    }})
    
    it("routes a list of messages to appropriate handlers", function() { with(this) {
      expect(server, "handshake").given(handshake, false).yielding([{}])
      expect(server, "connect").given(connect, false).yielding([{}])
      expect(server, "disconnect").given(disconnect, false).yielding([{}])
      expect(server, "subscribe").given(subscribe, false).yielding([{}])
      expect(server, "unsubscribe").given(unsubscribe, false).yielding([{}])
      
      expect(engine, "publish").given(handshake)
      expect(engine, "publish").given(connect)
      expect(engine, "publish").given(disconnect)
      expect(engine, "publish").given(subscribe)
      expect(engine, "publish").given(unsubscribe)
      expect(engine, "publish").given(publish)
      
      server.process([handshake, connect, disconnect, subscribe, unsubscribe, publish], false, function() {})
    }})
    
    describe("publishing a message", function() { with(this) {
      it("tells the engine to publish the message", function() { with(this) {
        expect(engine, "publish").given(publish)
        server.process(publish, false, function() {})
      }})
      
      it("returns no respons", function() { with(this) {
        stub(engine, "publish")
        server.process(publish, false, function(response) {
          assertEqual( [], response)
        })
      }})
      
      describe("with an error", function() { with(this) {
        before(function() { with(this) {
          publish.error = "invalid"
        }})
        
        it("does not tell the engine to publish the message", function() { with(this) {
          expect(engine, "publish").exactly(0)
          server.process(publish, false, function() {})
        }})
        
        it("returns no respons", function() { with(this) {
          stub(engine, "publish")
          server.process(publish, false, function(response) {
            assertEqual( [], response)
          })
          }})
      }})
    }})
    
    describe("handshaking", function() { with(this) {
      before(function() { with(this) {
        expect(engine, "publish").given(handshake)
        expect(server, "handshake").given(handshake, false).yielding([{successful: true}])
      }})
      
      it("returns the handshake response with advice", function() { with(this) {
        server.process(handshake, false, function(response) {
          assertEqual([
              { successful: true,
                advice: {reconnect: "retry", interval: 0, timeout: 60000}
              }
            ], response)
        })
      }})
    }})
    
    describe("connecting for messages", function() { with(this) {
      before(function() { with(this) {
        this.messages = [{channel: "/a"}, {channel: "/b"}]
        expect(engine, "publish").given(connect)
        expect(server, "connect").given(connect, false).yielding([messages])
      }})
      
      it("returns the new messages", function() { with(this) {
        server.process(connect, false, function(response) {
          assertEqual( messages, response )
        })
      }})
    }})
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
              supportedConnectionTypes: ["long-polling", "cross-origin-long-polling", "callback-polling", "websocket"],
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
                supportedConnectionTypes: ["long-polling", "cross-origin-long-polling", "callback-polling", "websocket"],
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
              supportedConnectionTypes: ["long-polling", "cross-origin-long-polling", "callback-polling", "websocket"]
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
              supportedConnectionTypes: ["long-polling", "cross-origin-long-polling", "callback-polling", "websocket"]
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
              supportedConnectionTypes: ["long-polling", "cross-origin-long-polling", "callback-polling", "websocket"]
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
              supportedConnectionTypes: ["long-polling", "cross-origin-long-polling", "callback-polling", "websocket"]
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
      
      it("returns an unsuccessful response", function() { with(this) {
        server.subscribe(message, false, function(response) {
          assertEqual({
              channel:      "/meta/subscribe",
              successful:   false,
              error:        "invalid",
              clientId:     clientId,
              subscription: "/foo"
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
