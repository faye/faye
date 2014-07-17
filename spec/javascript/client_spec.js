JS.ENV.ClientSpec = JS.Test.describe("Client", function() { with(this) {
  before(function() { with(this) {
    this.dispatcher = {connectionType: "fake-transport", retry: 5}
    stub(dispatcher, "selectTransport")
    stub(dispatcher, "sendMessage")

    Faye.extend(dispatcher, Faye.Publisher)
    stub("new", Faye, "Dispatcher").returns(dispatcher)

    stub("setTimeout")
  }})

  define("stubResponse", function(response) { with(this) {
    stub(dispatcher, "sendMessage", function(message) {
      response.id = message.id
      dispatcher.emit("message", response)
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
    return client.subscribe(channel, callback)
  }})

  describe("initialize", function() { with(this) {
    it("puts the client in the UNCONNECTED state", function() { with(this) {
      var client = new Faye.Client("http://localhost/")
      assertEqual( client.UNCONNECTED, client._state )
    }})
  }})

  describe("handshake", function() { with(this) {
    before(function() { this.createClient() })

    it("creates a transport the server must support", function() { with(this) {
      expect(dispatcher, "selectTransport").given(["long-polling", "callback-polling", "in-process"])
      client.handshake()
    }})

    it("sends a handshake message to the server", function() { with(this) {
      expect(dispatcher, "sendMessage").given({
        channel:  "/meta/handshake",
        version:  "1.0",
        supportedConnectionTypes: ["fake-transport"],
        id:       instanceOf("string")
      }, 72)
      client.handshake()
    }})

    it("puts the client in the CONNECTING state", function() { with(this) {
      client.handshake()
      assertEqual( client.CONNECTING, client._state )
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
        expect(dispatcher, "sendMessage").given({
          channel:  "/meta/handshake",
          version:  "1.0",
          supportedConnectionTypes: ["fake-transport"],
          id:       instanceOf("string"),
          ext:      {auth: "password"}
        }, 72)
        client.handshake()
      }})
    }})

    describe("on successful response", function() { with(this) {
      before(function() { with(this) {
        stubResponse({channel:    "/meta/handshake",
                      successful: true,
                      version:    "1.0",
                      supportedConnectionTypes: ["long-polling", "websocket"],
                      clientId:   "handshakeid" })
      }})

      it("stores the clientId", function() { with(this) {
        client.handshake()
        assertEqual( "handshakeid", client._dispatcher.clientId )
      }})

      it("puts the client in the CONNECTED state", function() { with(this) {
        client.handshake()
        assertEqual( client.CONNECTED, client._state )
      }})

      it("registers any pre-existing subscriptions", function() { with(this) {
        expect(client, "subscribe").given([], true)
        client.handshake()
      }})

      it("selects a new transport based on what the server supports", function() { with(this) {
        expect(dispatcher, "selectTransport").given(["long-polling", "websocket"])
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
        client.handshake()
        assertEqual( client.UNCONNECTED, client._state )
      }})
    }})

    describe("with existing subscriptions after a server restart", function() { with(this) {
      before(function(resume) { with(this) {
        createConnectedClient()
        this.message = null

        subscribe(client, "/messages/foo", function(m) { message = m }).then(function() {
          client._receiveMessage({advice: {reconnect: "handshake"}})

          stubResponse({channel:      "/meta/handshake",
                        successful:   true,
                        version:      "1.0",
                        supportedConnectionTypes: ["websocket"],
                        clientId:     "reconnectid",
                        subscription: "/messages/foo" })  // tacked on to trigger subscribe() callback

          resume()
        })
      }})

      it("resends the subscriptions to the server", function(resume) { with(this) {
        expect(dispatcher, "sendMessage").given({
          channel:      "/meta/subscribe",
          clientId:     "reconnectid",
          subscription: "/messages/foo",
          id:           instanceOf("string")
        }, 72)
        client.connect(resume)
      }})

      it("retains the listeners for the subscriptions", function() { with(this) {
        client.handshake()
        client._receiveMessage({channel: "/messages/foo", "data": "ok"})
        assertEqual( "ok", message )
      }})
    }})

    describe("with a connected client", function() { with(this) {
      before(function() { this.createConnectedClient() })

      it("does not send a handshake message to the server", function() { with(this) {
        expect(dispatcher, "sendMessage").given({
          channel:  "/meta/handshake",
          version:  "1.0",
          supportedConnectionTypes: ["fake-transport"],
          id:       instanceOf("string")
        }, 72)
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

      it("handshakes before connecting", function(resume) { with(this) {
        expect(dispatcher, "sendMessage").given({
          channel:        "/meta/connect",
          clientId:       "handshakeid",
          connectionType: "fake-transport",
          id:             instanceOf("string")
        }, 72)
        client.connect()
        Faye.Promise.defer(resume)
      }})
    }})

    describe("with a connected client", function() { with(this) {
      before(function() { this.createConnectedClient() })

      it("sends a connect message to the server", function() { with(this) {
        expect(dispatcher, "sendMessage").given({
          channel:        "/meta/connect",
          clientId:       "fakeid",
          connectionType: "fake-transport",
          id:             instanceOf("string")
        }, 72)
        client.connect()
      }})

      it("only opens one connect request at a time", function() { with(this) {
        expect(dispatcher, "sendMessage").given({
          channel:        "/meta/connect",
          clientId:       "fakeid",
          connectionType: "fake-transport",
          id:             instanceOf("string")
        }, 72)
        .exactly(1)

        client.connect()
        client.connect()
      }})
    }})
  }})

  describe("disconnect", function() { with(this) {
    before(function() { this.createConnectedClient() })

    it("sends a disconnect message to the server", function() { with(this) {
      expect(dispatcher, "sendMessage").given({
        channel:  "/meta/disconnect",
        clientId: "fakeid",
        id:       instanceOf("string")
      }, 72)
      client.disconnect()
    }})

    it("puts the client in the DISCONNECTED state", function() { with(this) {
      stub(dispatcher, "close")
      client.disconnect()
      assertEqual( client.DISCONNECTED, client._state )
    }})

    describe("on successful response", function() { with(this) {
      before(function() { with(this) {
        stubResponse({channel:      "/meta/disconnect",
                      successful:   true,
                      clientId:     "fakeid" })
      }})

      it("closes the dispatcher", function() { with(this) {
        expect(dispatcher, "close")
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
      it("sends a subscribe message to the server", function(resume) { with(this) {
        expect(dispatcher, "sendMessage").given(subscribeMessage, 72)
        client.subscribe("/foo")
        client.connect(resume)
      }})

      // The Bayeux spec says the server should accept a list of subscriptions
      // in one message but the cometD server doesn't actually support this
      describe("with an array of subscriptions", function() { with(this) {
        it("sends multiple subscribe messages", function(resume) { with(this) {
          expect(dispatcher, "sendMessage").given({
            channel:      "/meta/subscribe",
            clientId:     "fakeid",
            subscription: "/foo",
            id:           instanceOf("string")
          }, 72)
          expect(dispatcher, "sendMessage").given({
            channel:      "/meta/subscribe",
            clientId:     "fakeid",
            subscription: "/bar",
            id:           instanceOf("string")
          }, 72)
          client.subscribe(["/foo", "/bar"])
          client.connect(resume)
        }})

        it("returns an array of subscriptions", function() { with(this) {
          var subs = client.subscribe(["/foo", "/bar"])
          assertEqual( 2, subs.length )
          assertKindOf( Faye.Subscription, subs[0] )
        }})
      }})

      describe("on successful response", function() { with(this) {
        before(function() { with(this) {
          stubResponse({channel:      "/meta/subscribe",
                        successful:   true,
                        clientId:     "fakeid",
                        subscription: "/foo/*" })
        }})

        it("sets up a listener for the subscribed channel", function(resume) { with(this) {
          var message
          client.subscribe("/foo/*", function(m) { message = m }).then(function() {
            resume(function() {
              client._receiveMessage({channel: "/foo/bar", data: "hi"})
              assertEqual( "hi", message )
            })
          })
        }})

        it("does not call the listener for non-matching channels", function() { with(this) {
          var message
          client.subscribe("/foo/*", function(m) { message = m })
          client._receiveMessage({channel: "/bar", data: "hi"})
          assertEqual( undefined, message )
        }})

        it("activates the subscription", function(resume) { with(this) {
          client.subscribe("/foo/*").callback(resume)
        }})

        describe("with an incoming extension installed", function() { with(this) {
          before(function(resume) { with(this) {
            var extension = {
              incoming: function(message, callback) {
                if (message.data) message.data.changed = true
                callback(message)
              }
            }
            client.addExtension(extension)
            this.message = null
            client.subscribe("/foo/*", function(m) { message = m }).then(resume)
          }})

          it("passes delivered messages through the extension", function() { with(this) {
            client._receiveMessage({channel: "/foo/bar", data: {hello: "there"}})
            assertEqual( {hello: "there", changed: true}, message )
          }})
        }})

        describe("with an outgoing extension installed", function() { with(this) {
          before(function(resume) { with(this) {
            var extension = {
              outgoing: function(message, callback) {
                if (message.data) message.data.changed = true
                callback(message)
              }
            }
            client.addExtension(extension)
            this.message = null
            client.subscribe("/foo/*", function(m) { message = m }).then(resume)
          }})

          it("leaves messages unchanged", function() { with(this) {
            client._receiveMessage({channel: "/foo/bar", data: {hello: "there"}})
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
            client._receiveMessage({channel: "/foo/bar", data: "hi"})
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
          client._receiveMessage({channel: "/meta/foo", data: "hi"})
          assertEqual( undefined, message )
        }})

        it("does not activate the subscription", function(resume) { with(this) {
          client.subscribe("/meta/foo").errback(function() { resume() })
        }})

        it("reports the error through an errback", function(resume) { with(this) {
          client.subscribe("/meta/foo").errback(function(error) {
            resume(function() {
              assertEqual( objectIncluding({code: 403, params: ["/meta/foo"], message: "Forbidden channel"}), error )
            })
          })
        }})
      }})
    }})

    describe("with an existing subscription", function() { with(this) {
      before(function() { with(this) {
        subscribe(client, "/foo/*")
      }})

      it("does not send another subscribe message to the server", function() { with(this) {
        expect(dispatcher, "sendMessage").given(subscribeMessage, 72).exactly(0)
        client.subscribe("/foo/*")
      }})

      it("sets up another listener on the channel", function(resume) { with(this) {
        client.subscribe("/foo/*", function() { subsCalled += 1 }).then(function() {
          resume(function() {
            client._receiveMessage({channel: "/foo/bar", data: "hi"})
            assertEqual( 2, subsCalled )
          })
        })
      }})

      it("activates the subscription", function(resume) { with(this) {
        client.subscribe("/foo/*").callback(resume)
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
        expect(dispatcher, "sendMessage").given(unsubscribeMessage, 72).exactly(0)
        client.unsubscribe("/foo/*")
      }})
    }})

    describe("with a single subscription", function() { with(this) {
      before(function(resume) { with(this) {
        this.message  = null
        this.listener = function(m) { message = m }
        subscribe(client, "/foo/*", listener).then(resume)
      }})

      it("sends an unsubscribe message to the server", function(resume) { with(this) {
        expect(dispatcher, "sendMessage").given(unsubscribeMessage, 72)
        client.unsubscribe("/foo/*")
        client.connect(resume)
      }})

      it("removes the listener from the channel", function() { with(this) {
        client._receiveMessage({channel: "/foo/bar", data: "first"})
        client.unsubscribe("/foo/*", listener)
        client._receiveMessage({channel: "/foo/bar", data: "second"})
        assertEqual( "first", message )
      }})
    }})

    describe("with multiple subscriptions to the same channel", function() { with(this) {
      before(function(resume) { with(this) {
        this.messages = []
        this.hey = function(m) { messages.push("hey " + m.text) }
        this.bye = function(m) { messages.push("bye " + m.text) }

        subscribe(client, "/foo/*", hey).then(function() {
          return subscribe(client, "/foo/*", bye)
        }).then(resume)
      }})

      it("removes one of the listeners from the channel", function() { with(this) {
        client._receiveMessage({channel: "/foo/bar", data: {text: "you"}})
        client.unsubscribe("/foo/*", hey)
        client._receiveMessage({channel: "/foo/bar", data: {text: "you"}})
        assertEqual( ["hey you", "bye you", "bye you"], messages)
      }})

      it("does not send an unsubscribe message if one listener is removed", function() { with(this) {
        expect(dispatcher, "sendMessage").given(unsubscribeMessage, 72).exactly(0)
        client.unsubscribe("/foo/*", bye)
      }})

      it("sends an unsubscribe message if each listener is removed", function(resume) { with(this) {
        expect(dispatcher, "sendMessage").given(unsubscribeMessage, 72)
        client.unsubscribe("/foo/*", bye)
        client.unsubscribe("/foo/*", hey)
        client.connect(resume)
      }})

      it("sends an unsubscribe message if all listeners are removed", function(resume) { with(this) {
        expect(dispatcher, "sendMessage").given(unsubscribeMessage, 72)
        client.unsubscribe("/foo/*")
        client.connect(resume)
      }})
    }})

    describe("with multiple subscriptions to different channels", function() { with(this) {
      before(function(resume) { with(this) {
        subscribe(client, "/foo").then(function() {
          return subscribe(client, "/bar")
        }).then(resume)
      }})

      it("sends multiple unsubscribe messages if given an array", function(resume) { with(this) {
        expect(dispatcher, "sendMessage").given({
          channel:      "/meta/unsubscribe",
          clientId:     "fakeid",
          subscription: "/foo",
          id:           instanceOf("string")
        }, 72)
        expect(dispatcher, "sendMessage").given({
          channel:      "/meta/unsubscribe",
          clientId:     "fakeid",
          subscription: "/bar",
          id:           instanceOf("string")
        }, 72)
        client.unsubscribe(["/foo", "/bar"])
        client.connect(resume)
      }})
    }})
  }})

  describe("publish", function() { with(this) {
    before(function() { this.createConnectedClient() })

    it("sends the message to the server with an ID", function(resume) { with(this) {
      expect(dispatcher, "sendMessage").given({
        channel:  "/messages/foo",
        clientId: "fakeid",
        data:     {hello: "world"},
        id:       instanceOf("string")
      }, 72)
      client.publish("/messages/foo", {hello: "world"})
      client.connect(resume)
    }})

    describe("on publish failure", function() { with(this) {
      before(function() { with(this) {
        stubResponse({channel:    "/messages/foo",
                      error:      "407:/messages/foo:Failed to publish",
                      successful: false,
                      clientId:   "fakeid" })
      }})

      it("should not be published", function() { with(this) {
        var published = false
        client.publish("/messages/foo", {text: "hi"}).callback(function() { published = true })
        assert( !published )
      }})

      it("reports the error through an errback", function(resume) { with(this) {
        client.publish("/messages/foo", {text: "hi"}).errback(function(error) {
          resume(function() {
            assertEqual( 407, error.code )
            assertEqual( ["/messages/foo"], error.params )
            assertEqual( "Failed to publish", error.message )
          })
        })
      }})
    }})

    describe("on receipt of the published message", function() { with(this) {
      before(function() { with(this) {
        stubResponse({channel:    "/messages/foo",
                      data:       {text: "hi"},
                      clientId:   "fakeid" })
      }})

      it("does not trigger the callbacks", function() { with(this) {
        var published = false
        var publication = client.publish("/messages/foo", {text: "hi"})
        publication.callback(function() { published = true })
        publication.errback(function() { published = true })
        assert( !published )
      }})
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

      it("passes messages through the extension", function(resume) { with(this) {
        expect(dispatcher, "sendMessage").given({
          channel:  "/messages/foo",
          clientId: "fakeid",
          data:     {hello: "world"},
          id:       instanceOf("string"),
          ext:      {auth: "password"}
        }, 72)
        client.publish("/messages/foo", {hello: "world"})
        client.connect(resume)
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

      it("leaves the message unchanged", function(resume) { with(this) {
        expect(dispatcher, "sendMessage").given({
          channel:  "/messages/foo",
          clientId: "fakeid",
          data:     {hello: "world"},
          id:       instanceOf("string")
        }, 72)
        client.publish("/messages/foo", {hello: "world"})
        client.connect(resume)
      }})
    }})
  }})
}})
