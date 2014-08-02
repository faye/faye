JS.ENV.EngineSteps = JS.Test.asyncSteps({
  create_client: function(name, resume) {
    var inboxes = this._inboxes = this._inboxes || {}
    var clients = this._clients = this._clients || {}
    this.engine.createClient(function(clientId) {
      clients[name] = clientId
      inboxes[name] = inboxes[name] || []
      resume()
    })
  },

  connect: function(name, engine, resume) {
    var clientId = this._clients[name]
    var inboxes  = this._inboxes
    engine.connect(clientId, {}, function(messages) {
      for (var i = 0, n = messages.length; i < n; i++) {
        delete messages[i].id
        inboxes[name].push(messages[i])
      }
    })
    setTimeout(resume, 10)
  },

  destroy_client: function(name, resume) {
    this.engine.destroyClient(this._clients[name], resume)
  },

  check_client_id: function(name, pattern, resume) {
    this.assertMatch(pattern, this._clients[name])
    resume()
  },

  check_num_clients: function(n, resume) {
    var ids = new JS.Set()
    for (var key in this._clients) ids.add(this._clients[key])
    this.assertEqual(n, ids.count())
    resume()
  },

  check_client_exists: function(name, exists, resume) {
    var tc = this
    tc.engine.clientExists(tc._clients[name], function(actual) {
      tc.assertEqual(exists, actual)
      resume()
    })
  },

  subscribe: function(name, channel, resume) {
    this.engine.subscribe(this._clients[name], channel, resume)
  },

  unsubscribe: function(name, channel, resume) {
    this.engine.unsubscribe(this._clients[name], channel, resume)
  },

  publish: function(messages, resume) {
    messages = [].concat(messages)
    for (var i = 0, n = messages.length; i < n; i++) {
      var message = Faye.extend({id: Faye.random()}, messages[i])
      this.engine.publish(message)
    }
    setTimeout(resume, 20)
  },

  publish_by: function(name, message, resume) {
    message = Faye.extend({clientId: this._clients[name], id: Faye.random()}, message)
    this.engine.publish(message)
    setTimeout(resume, 10)
  },

  ping: function(name, resume) {
    this.engine.ping(this._clients[name])
    resume()
  },

  clock_tick: function(time, resume) {
    setTimeout(resume, time)
  },

  expect_non_exclusive_event: function(name, event, args, engine, resume) {
    var params  = [this._clients[name]].concat(args),
        handler = function() {};

    // we don't care if the event is called for other clients
    var filter = function() {
      if (arguments[0] == params[0]) {
        handler.apply(undefined, Array.prototype.slice.call(arguments));
      }
    };

    engine.bind(event, filter)
    this.expect(handler, "apply").given(undefined, params).exactly(1)
    resume()
  },

  expect_event: function(name, event, args, resume) {
    var params  = [this._clients[name]].concat(args),
        handler = function() {}

    this.engine.bind(event, handler)
    this.expect(handler, "apply").given(undefined, params)
    resume()
  },

  expect_no_event: function(name, event, args, resume) {
    var params  = [this._clients[name]].concat(args),
        handler = function() {}

    this.engine.bind(event, handler)
    this.expect(handler, "apply").given(undefined, params).exactly(0)
    resume()
  },

  expect_message: function(name, messages, resume) {
    this.assertEqual(messages, this._inboxes[name])
    resume()
  },

  expect_no_message: function(name, resume) {
    this.assertEqual([], this._inboxes[name])
    resume()
  },

  check_different_messages: function(a, b, resume) {
    this.assertNotSame(this._inboxes[a][0], this._inboxes[b][0])
    resume()
  }
})

JS.ENV.EngineSpec = JS.Test.describe("Pub/sub engines", function() { with(this) {
  sharedExamplesFor("faye engine", function() { with(this) {
    include(JS.Test.Helpers)
    include(EngineSteps)

    define("create_engine", function() { with(this) {
      var opts = Faye.extend(options(), engineOpts)
      return new Faye.Engine.Proxy(opts)
    }})

    define("options", function() { return {timeout: 1} })

    before(function() { with(this) {
      this.engine = create_engine()
      create_client("alice")
      create_client("bob")
      create_client("carol")
    }})

    describe("createClient", function() { with(this) {
      it("returns a client id", function() { with(this) {
        create_client("dave")
        check_client_id("dave", /^[a-z0-9]+$/)
      }})

      it("returns a different id every time", function() { with(this) {
        $R(1,7).forEach(function(i) { create_client("client" + i) })
        check_num_clients(10)
      }})

      it("publishes an event", function() { with(this) {
        expect(engine, "trigger").given("handshake", match(/^[a-z0-9]+$/))
        create_client("dave")
      }})
    }})

    describe("clientExists", function() { with(this) {
      it("returns true if the client id exists", function() { with(this) {
        check_client_exists("alice", true)
      }})

      it("returns false if the client id does not exist", function() { with(this) {
        check_client_exists("anything", false)
      }})
    }})

    describe("ping", function() { with(this) {
      define("options", function() { return {timeout: 0.3, gc: 0.08} })

      it("removes a client if it does not ping often enough", function() { with(this) {
        clock_tick(700)
        check_client_exists("alice", false)
      }})

      it("prolongs the life of a client", function() { with(this) {
        clock_tick(450)
        ping("alice")
        clock_tick(450)
        check_client_exists("alice", true)
        clock_tick(450)
        check_client_exists("alice", false)
      }})
    }})

    describe("destroyClient", function() { with(this) {
      it("removes the given client", function() { with(this) {
        destroy_client("alice")
        check_client_exists("alice", false)
      }})

      it("publishes an event", function() { with(this) {
        expect_event("alice", "disconnect", [])
        destroy_client("alice")
      }})

      describe("when the client has subscriptions", function() { with(this) {
        before(function() { with(this) {
          this.message = {"channel": "/messages/foo", "data": "ok"}
          subscribe("alice", "/messages/foo")
        }})

        it("stops the client receiving messages", function() { with(this) {
          connect("alice", engine)
          destroy_client("alice")
          publish(message)
          expect_no_message("alice")
        }})

        it("publishes an event", function() { with(this) {
          expect_event("alice", "disconnect", [])
          destroy_client("alice")
        }})
      }})
    }})

    describe("subscribe", function() { with(this) {
      it("publishes an event", function() { with(this) {
        expect_event("alice", "subscribe", ["/messages/foo"])
        subscribe("alice", "/messages/foo")
      }})

      describe("when the client is subscribed to the channel", function() { with(this) {
        before(function() { this.subscribe("alice", "/messages/foo") })

        it("does not publish an event", function() { with(this) {
          expect_no_event("alice", "subscribe", ["/messages/foo"])
          subscribe("alice", "/messages/foo")
        }})
      }})
    }})


    describe("unsubscribe", function() { with(this) {
      before(function() { this.subscribe("alice", "/messages/bar") })

      it("does not publish an event", function() { with(this) {
        expect_no_event("alice", "unsubscribe", ["/messages/foo"])
        unsubscribe("alice", "/messages/foo")
      }})

      describe("when the client is subscribed to the channel", function() { with(this) {
        before(function() { this.subscribe("alice", "/messages/foo") })

        it("publishes an event", function() { with(this) {
          expect_event("alice", "unsubscribe", ["/messages/foo"])
          unsubscribe("alice", "/messages/foo")
        }})
      }})
    }})

    describe("publish", function() { with(this) {
      before(function() { with(this) {
        this.message = {"channel": "/messages/foo", "data": "ok", "blank": null}
        connect("alice", engine)
        connect("bob", engine)
        connect("carol", engine)
      }})

      describe("with no subscriptions", function() { with(this) {
        it("delivers no messages", function() { with(this) {
          publish(message)
          expect_no_message("alice")
          expect_no_message("bob")
          expect_no_message("carol")
        }})

        it("publishes a :publish event with a clientId", function() { with(this) {
          expect_event("bob", "publish", ["/messages/foo", "ok"])
          publish_by("bob", message)
        }})

        it("publishes a :publish event with no clientId", function() { with(this) {
          expect_event(null, "publish", ["/messages/foo", "ok"])
          publish(message)
        }})
      }})

      describe("with a subscriber", function() { with(this) {
        before(function() { with(this) {
          subscribe("alice", "/messages/foo")
        }})

        it("delivers multibyte messages correctly", function() { with(this) {
          message.data = "Apple = "
          publish(message)
          expect_message("alice", [message])
        }})

        it("delivers messages to the subscribed client", function() { with(this) {
          publish(message)
          expect_message("alice", [message])
        }})

        it("publishes a :publish event with a clientId", function() { with(this) {
          expect_event("bob", "publish", ["/messages/foo", "ok"])
          publish_by("bob", message)
        }})
      }})

      describe("with a subscriber that is removed", function() { with(this) {
        before(function() { with(this) {
          subscribe("alice", "/messages/foo")
          unsubscribe("alice", "/messages/foo")
        }})

        it("does not deliver messages to unsubscribed clients", function() { with(this) {
          publish(message)
          expect_no_message("alice")
          expect_no_message("bob")
          expect_no_message("carol")
        }})

        it("publishes a :publish event with a clientId", function() { with(this) {
          expect_event("bob", "publish", ["/messages/foo", "ok"])
          publish_by("bob", message)
        }})
      }})

      describe("with multiple subscribers", function() { with(this) {
        before(function() { with(this) {
          subscribe("alice", "/messages/foo")
          subscribe("bob",   "/messages/bar")
          subscribe("carol", "/messages/foo")
        }})

        it("delivers messages to the subscribed clients", function() { with(this) {
          publish(message)
          expect_message("alice", [message])
          expect_no_message("bob")
          expect_message("carol", [message])
        }})
      }})

      describe("with a single wildcard", function() { with(this) {
        before(function() { with(this) {
          subscribe("alice", "/messages/*")
          subscribe("bob",   "/messages/bar")
          subscribe("carol", "/*")
        }})

        it("delivers messages to matching subscriptions", function() { with(this) {
          publish(message)
          expect_message("alice", [message])
          expect_no_message("bob")
          expect_no_message("carol")
        }})
      }})

      describe("with a double wildcard", function() { with(this) {
        before(function() { with(this) {
          subscribe("alice", "/messages/**")
          subscribe("bob",   "/messages/bar")
          subscribe("carol", "/**")
        }})

        it("delivers messages to matching subscriptions", function() { with(this) {
          publish(message)
          expect_message("alice", [message])
          expect_no_message("bob")
          expect_message("carol", [message])
        }})

        it("delivers a unique copy of the message to each client", function() { with(this) {
          publish(message)
          check_different_messages("alice", "carol")
        }})
      }})

      describe("with multiple matching subscriptions for the same client", function() { with(this) {
        before(function() { with(this) {
          subscribe("alice", "/messages/*")
          subscribe("alice", "/messages/foo")
        }})

        it("delivers each message once to each client", function() { with(this) {
          publish(message)
          expect_message("alice", [message])
        }})

        it("delivers the message as many times as it is published", function() { with(this) {
          publish([message, message])
          expect_message("alice", [message, message])
        }})
      }})
    }})
  }})

  sharedBehavior("distributed engine", function() { with(this) {
    include(JS.Test.Helpers)
    include(EngineSteps)

    define("create_engine", function() { with(this) {
      var opts = Faye.extend(options(), engineOpts)
      return new Faye.Engine.Proxy(opts)
    }})

    define("options", function() { return {timeout: 1} })

    before(function() { with(this) {
      this.left   = create_engine()
      this.right  = create_engine()
      this.engine = left

      create_client("alice")
      create_client("bob")

      connect("alice", left)
    }})

    describe("publish", function() { with(this) {
      before(function() { with(this) {
        subscribe("alice", "/foo")
        publish({channel: "/foo", data: "first"})
      }})

      it("only delivers each message once", function() { with(this) {
        expect_message("alice", [{channel: "/foo", data: "first"}])
        publish({channel: "/foo", data: "second"})
        connect("alice", right)
        expect_message("alice", [{channel: "/foo", data: "first"}, {channel: "/foo", data: "second"}])
      }})
    }})

    describe("gc", function() { with(this) {
      define("options", function() { return {timeout: 0.3, gc: 0.08} })

      it("calls close in each engine when a client is removed", function() { with(this) {
        expect_non_exclusive_event("alice", "close", [], this.left);
        expect_non_exclusive_event("alice", "close", [], this.right);

        clock_tick(700);
      }})
    }})
  }})
}})
