JS.ENV.ClientSpec = JS.Test.describe("Client", function() { with(this) {
  before(function() { with(this) {
    this.transport = {connectionType: "fake", send: function() {}}
    stub(Faye.Transport, "get").yields([transport])
  }})
  
  before(function() { with(this) {
    stub("setTimeout")
  }})
  
  define("stubResponse", function(response) { with(this) {
    stub(transport, "send", function(message) {
      response.id = message.id
      client.receiveMessage(response)
    })
  }})

  define("createClient", function() { with(this) {
    this.client = new Faye.Client("http://localhost/")
  }})
  
  define("createConnectedClient", function() { with(this) {
    createClient()
    stubResponse({channel:    "/meta/handshake",
                  successful: true,
                  version:    "1.0",
                  supportedConnectionTypes: ["websocket"],
                  clientId:   "fakeid" })
    
    client.handshake()
  }})
  
  define("subscribe", function(client, channel, callback) { with(this) {
    stubResponse({channel:      "/meta/subscribe",
                  successful:   true,
                  clientId:     "fakeid",
                  subscription: channel })
    
    this.subsCalled = 0
    callback = callback || function() { subsCalled += 1 }
    client.subscribe(channel, callback)
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
    
    describe("with an outgoing extension installed", function() { with(this) {
      before(function() { with(this) {
        var extension = {
          outgoing: function(message, callback) {
            message.ext = {auth: "password"}
            callback(message)
          }
        }
        client.addExtension(extension)
      }})
      
      it("passes the handshake message through the extension", function() { with(this) {
        expect(transport, "send").given({
          channel:  "/meta/handshake",
          version:  "1.0",
          supportedConnectionTypes: ["fake"],
          id:       instanceOf("string"),
          ext:      {auth: "password"}
        }, 60)
        client.handshake()
      }})
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
        expect(client, "subscribe").given([], true)
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
    
    describe("with existing subscriptions after a server restart", function() { with(this) {
      before(function() { with(this) {
        createConnectedClient()
        
        this.message = null
        subscribe(client, "/messages/foo", function(m) { message = m })
        
        client.receiveMessage({advice: {reconnect: "handshake"}})
        
        stubResponse({channel:      "/meta/handshake",
                      successful:   true,
                      version:      "1.0",
                      supportedConnectionTypes: ["websocket"],
                      clientId:     "reconnectid",
                      subscription: "/messages/foo" })  // tacked on to trigger subscribe() callback
      }})
      
      it("resends the subscriptions to the server", function() { with(this) {
        expect(transport, "send").given({
          channel:      "/meta/subscribe",
          clientId:     "reconnectid",
          subscription: "/messages/foo",
          id:           instanceOf("string")
        }, 60)
        client.handshake()
      }})
      
      it("retains the listeners for the subscriptions", function() { with(this) {
        client.handshake()
        client.receiveMessage({channel: "/messages/foo", "data": "ok"})
        assertEqual( "ok", message )
      }})
    }})
    
    describe("with a connected client", function() { with(this) {
      before(function() { this.createConnectedClient() })
      
      it("does not send a handshake message to the server", function() { with(this) {
        expect(transport, "send").given({
          channel:  "/meta/handshake",
          version:  "1.0",
          supportedConnectionTypes: ["fake"],
          id:       instanceOf("string")
        }, 60)
        .exactly(0)
        
        client.handshake()
      }})
    }})
  }})
  
  describe("connect", function() { with(this) {
    describe("with an unconnected client", function() { with(this) {
      before(function() { with(this) {
        stubResponse({channel:    "/meta/handshake",
                      successful: true,
                      version:    "1.0",
                      supportedConnectionTypes: ["websocket"],
                      clientId:   "handshakeid" })
        
        createClient()
      }})
      
      it("handshakes before connecting", function() { with(this) {
        expect(transport, "send").given({
          channel:        "/meta/connect",
          clientId:       "handshakeid",
          connectionType: "fake",
          id:             instanceOf("string")
        }, 60)
        client.connect()
      }})
    }})
    
    describe("with a connected client", function() { with(this) {
      before(function() { this.createConnectedClient() })
      
      it("sends a connect message to the server", function() { with(this) {
        expect(transport, "send").given({
          channel:        "/meta/connect",
          clientId:       "fakeid",
          connectionType: "fake",
          id:             instanceOf("string")
        }, 60)
        client.connect()
      }})
      
      it("only opens one connect request at a time", function() { with(this) {
        expect(transport, "send").given({
          channel:        "/meta/connect",
          clientId:       "fakeid",
          connectionType: "fake",
          id:             instanceOf("string")
        }, 60)
        .exactly(1)
        
        client.connect()
        client.connect()
      }})
    }})
  }})
  
  describe("disconnect", function() { with(this) {
    before(function() { this.createConnectedClient() })
    
    it("sends a disconnect message to the server", function() { with(this) {
      expect(transport, "send").given({
        channel:  "/meta/disconnect",
        clientId: "fakeid",
        id:       instanceOf("string")
      }, 60)
      client.disconnect()
    }})
    
    it("puts the client in the DISCONNECTED state", function() { with(this) {
      stub(transport, "close")
      client.disconnect()
      assertEqual( "DISCONNECTED", client.getState() )
    }})
    
    describe("on successful response", function() { with(this) {
      before(function() { with(this) {
        stubResponse({channel:      "/meta/disconnect",
                      successful:   true,
                      clientId:     "fakeid" })
      }})
      
      it("closes the transport", function() { with(this) {
        expect(transport, "close")
        client.disconnect()
      }})
    }})
  }})
  
  describe("subscribe", function() { with(this) {
    before(function() { with(this) {
      createConnectedClient()
      this.subscribeMessage = {
          channel:      "/meta/subscribe",
          clientId:     "fakeid",
          subscription: "/foo",
          id:           instanceOf("string")
        }
    }})
    
    describe("with no prior subscriptions", function() { with(this) {
      it("sends a subscribe message to the server", function() { with(this) {
        expect(transport, "send").given(subscribeMessage, 60)
        client.subscribe("/foo")
      }})
      
      // The Bayeux spec says the server should accept a list of subscriptions
      // in one message but the cometD server doesn't actually support this
      it("sends multiple subscribe messages if given an array", function() { with(this) {
        expect(transport, "send").given({
          channel:      "/meta/subscribe",
          clientId:     "fakeid",
          subscription: "/foo",
          id:           instanceOf("string")
        }, 60)
        expect(transport, "send").given({
          channel:      "/meta/subscribe",
          clientId:     "fakeid",
          subscription: "/bar",
          id:           instanceOf("string")
        }, 60)
        client.subscribe(["/foo", "/bar"])
      }})
      
      describe("on successful response", function() { with(this) {
        before(function() { with(this) {
          stubResponse({channel:      "/meta/subscribe",
                        successful:   true,
                        clientId:     "fakeid",
                        subscription: "/foo/*" })
        }})
        
        it("sets up a listener for the subscribed channel", function() { with(this) {
          var message
          client.subscribe("/foo/*", function(m) { message = m })
          client.receiveMessage({channel: "/foo/bar", data: "hi"})
          assertEqual( "hi", message )
        }})
        
        it("does not call the listener for non-matching channels", function() { with(this) {
          var message
          client.subscribe("/foo/*", function(m) { message = m })
          client.receiveMessage({channel: "/bar", data: "hi"})
          assertEqual( undefined, message )
        }})
        
        it("activates the subscription", function() { with(this) {
          var active = false
          client.subscribe("/foo/*").callback(function() { active = true })
          assert( active )
        }})
        
        describe("with an incoming extension installed", function() { with(this) {
          before(function() { with(this) {
            var extension = {
              incoming: function(message, callback) {
                if (message.data) message.data.changed = true
                callback(message)
              }
            }
            client.addExtension(extension)
            this.message = null
            client.subscribe("/foo/*", function(m) { message = m })
          }})
          
          it("passes delivered messages through the extension", function() { with(this) {
            client.receiveMessage({channel: "/foo/bar", data: {hello: "there"}})
            assertEqual( {hello: "there", changed: true}, message )
          }})
        }})
        
        describe("with an outgoing extension installed", function() { with(this) {
          before(function() { with(this) {
            var extension = {
              outgoing: function(message, callback) {
                if (message.data) message.data.changed = true
                callback(message)
              }
            }
            client.addExtension(extension)
            this.message = null
            client.subscribe("/foo/*", function(m) { message = m })
          }})
          
          it("leaves messages unchanged", function() { with(this) {
            client.receiveMessage({channel: "/foo/bar", data: {hello: "there"}})
            assertEqual( {hello: "there"}, message )
          }})
        }})
        
        describe("with an incoming extension that invalidates the response", function() { with(this) {
          before(function() { with(this) {
            var extension = {
              incoming: function(message, callback) {
                if (message.channel === "/meta/subscribe") message.successful = false
                callback(message)
              }
            }
            client.addExtension(extension)
          }})
          
          it("does not set up a listener for the subscribed channel", function() { with(this) {
            var message
            client.subscribe("/foo/*", function(m) { message = m })
            client.receiveMessage({channel: "/foo/bar", data: "hi"})
            assertEqual( undefined, message )
          }})
          
          it("does not activate the subscription", function() { with(this) {
            var active = false
            client.subscribe("/foo/*").callback(function() { active = true })
            assert( !active )
          }})
        }})
      }})
      
      describe("on unsuccessful response", function() { with(this) {
        before(function() { with(this) {
          stubResponse({channel:      "/meta/subscribe",
                        successful:   false,
                        error:        "403:/meta/foo:Forbidden channel",
                        clientId:     "fakeid",
                        subscription: "/meta/foo" })
        }})
        
        it("does not set up a listener for the subscribed channel", function() { with(this) {
          var message
          client.subscribe("/meta/foo", function(m) { message = m })
          client.receiveMessage({channel: "/meta/foo", data: "hi"})
          assertEqual( undefined, message )
        }})
        
        it("does not activate the subscription", function() { with(this) {
          var active = false
          client.subscribe("/meta/foo").callback(function() { active = true })
          assert( !active )
        }})

        it("reports the error through an errback", function() { with(this) {
          var error = null
          client.subscribe("/meta/foo").errback(function(e) { error = e })
          assertEqual( objectIncluding({code: 403, params: ["/meta/foo"], message: "Forbidden channel"}), error )
        }})
      }})
    }})
    
    describe("with an existing subscription", function() { with(this) {
      before(function() { with(this) {
        subscribe(client, "/foo/*")
      }})
      
      it("does not send another subscribe message to the server", function() { with(this) {
        expect(transport, "send").given(subscribeMessage, 60).exactly(0)
        client.subscribe("/foo/*")
      }})
      
      it("sets up another listener on the channel", function() { with(this) {
        client.subscribe("/foo/*", function() { subsCalled += 1 })
        client.receiveMessage({channel: "/foo/bar", data: "hi"})
        assertEqual( 2, subsCalled )
      }})
      
      it("activates the subscription", function() { with(this) {
        var active = false
        client.subscribe("/foo/*").callback(function() { active = true })
        assert( active )
      }})
    }})
  }})
  
  describe("unsubscribe", function() { with(this) {
    before(function() { with(this) {
      createConnectedClient()
      this.unsubscribeMessage = {
          channel:      "/meta/unsubscribe",
          clientId:     "fakeid",
          subscription: "/foo/*",
          id:           instanceOf("string")
        }
    }})
    
    describe("with no subscriptions", function() { with(this) {
      it("does not send an unsubscribe message to the server", function() { with(this) {
        expect(transport, "send").given(unsubscribeMessage, 60).exactly(0)
        client.unsubscribe("/foo/*")
      }})
    }})
    
    describe("with a single subscription", function() { with(this) {
      before(function() { with(this) {
        this.message  = null
        this.listener = function(m) { message = m }
        subscribe(client, "/foo/*", listener)
      }})
      
      it("sends an unsubscribe message to the server", function() { with(this) {
        expect(transport, "send").given(unsubscribeMessage, 60)
        client.unsubscribe("/foo/*")
      }})
      
      it("removes the listener from the channel", function() { with(this) {
        client.receiveMessage({channel: "/foo/bar", data: "first"})
        client.unsubscribe("/foo/*", listener)
        client.receiveMessage({channel: "/foo/bar", data: "second"})
        assertEqual( "first", message )
      }})
    }})
    
    describe("with multiple subscriptions to the same channel", function() { with(this) {
      before(function() { with(this) {
        this.messages = []
        this.hey = function(m) { messages.push("hey " + m.text) }
        this.bye = function(m) { messages.push("bye " + m.text) }
        subscribe(client, "/foo/*", hey)
        subscribe(client, "/foo/*", bye)
      }})
      
      it("removes one of the listeners from the channel", function() { with(this) {
        client.receiveMessage({channel: "/foo/bar", data: {text: "you"}})
        client.unsubscribe("/foo/*", hey)
        client.receiveMessage({channel: "/foo/bar", data: {text: "you"}})
        assertEqual( ["hey you", "bye you", "bye you"], messages)
      }})
      
      it("does not send an unsubscribe message if one listener is removed", function() { with(this) {
        expect(transport, "send").given(unsubscribeMessage, 60).exactly(0)
        client.unsubscribe("/foo/*", bye)
      }})
      
      it("sends an unsubscribe message if each listener is removed", function() { with(this) {
        expect(transport, "send").given(unsubscribeMessage, 60)
        client.unsubscribe("/foo/*", bye)
        client.unsubscribe("/foo/*", hey)
      }})
      
      it("sends an unsubscribe message if all listeners are removed", function() { with(this) {
        expect(transport, "send").given(unsubscribeMessage, 60)
        client.unsubscribe("/foo/*")
      }})
    }})
    
    describe("with multiple subscriptions to different channels", function() { with(this) {
      before(function() { with(this) {
        subscribe(client, "/foo")
        subscribe(client, "/bar")
      }})
      
      it("sends multiple unsubscribe messages if given an array", function() { with(this) {
        expect(transport, "send").given({
          channel:      "/meta/unsubscribe",
          clientId:     "fakeid",
          subscription: "/foo",
          id:           instanceOf("string")
        }, 60)
        expect(transport, "send").given({
          channel:      "/meta/unsubscribe",
          clientId:     "fakeid",
          subscription: "/bar",
          id:           instanceOf("string")
        }, 60)
        client.unsubscribe(["/foo", "/bar"])
      }})
    }})
  }})
  
  describe("publish", function() { with(this) {
    before(function() { this.createConnectedClient() })
    
    it("sends the message to the server with an ID", function() { with(this) {
      expect(transport, "send").given({
        channel:  "/messages/foo",
        clientId: "fakeid",
        data:     {hello: "world"},
        id:       instanceOf("string")
      }, 60)
      client.publish("/messages/foo", {hello: "world"})
    }})
    
    it("throws an error when publishing to an invalid channel", function() { with(this) {
      expect(transport, "send").given(objectIncluding({channel: "/messages/*"}), 60).exactly(0)
      assertThrows(Error, function() { client.publish("/messages/*", {hello: "world"}) })
    }})
    
    describe("with an outgoing extension installed", function() { with(this) {
      before(function() { with(this) {
        var extension = {
          outgoing: function(message, callback) {
            message.ext = {auth: "password"}
            callback(message)
          }
        }
        client.addExtension(extension)
      }})
      
      it("passes messages through the extension", function() { with(this) {
        expect(transport, "send").given({
          channel:  "/messages/foo",
          clientId: "fakeid",
          data:     {hello: "world"},
          id:       instanceOf("string"),
          ext:      {auth: "password"}
        }, 60)
        client.publish("/messages/foo", {hello: "world"})
      }})
    }})
    
    describe("with an incoming extension installed", function() { with(this) {
      before(function() { with(this) {
        var extension = {
          incoming: function(message, callback) {
            message.ext = {auth: "password"}
            callback(message)
          }
        }
        client.addExtension(extension)
      }})
      
      it("leaves the message unchanged", function() { with(this) {
        expect(transport, "send").given({
          channel:  "/messages/foo",
          clientId: "fakeid",
          data:     {hello: "world"},
          id:       instanceOf("string")
        }, 60)
        client.publish("/messages/foo", {hello: "world"})
      }})
    }})
  }})
}})
