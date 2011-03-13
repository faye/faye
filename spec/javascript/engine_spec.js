JS.ENV.EngineSteps = JS.Test.asyncSteps({
  create_client: function(name, resume) {
    var clients = this._clients = this._clients || {}
    this.engine.createClient(function(clientId) {
      clients[name] = clientId
      resume()
    })
  },
  
  destroy_client: function(name, resume) {
    this.engine.destroyClient(this._clients[name])
    resume()
  },
  
  check_client_id: function(name, pattern, resume) {
    this.assertMatch(pattern, this._clients[name])
    resume()
  },
  
  check_num_clients: function(n, resume) {
    var ids = new JS.Set()
    Faye.each(this._clients, function(name, id) { ids.add(id) })
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
  
  publish: function(message, resume) {
    this.engine.publish(message)
    resume()
  },
  
  ping: function(name, resume) {
    this.engine.ping(this._clients[name])
    resume()
  },
  
  clock_tick: function(time, resume) {
    this.clock.tick(time)
    resume()
  },
  
  expect_disconnect: function(name, resume) {
    this.expect(this.engine, "publishEvent").given("disconnect", this._clients[name])
    resume()
  },
  
  expect_announce: function(name, message, resume) {
    this.expect(this.engine, "announce").given(this._clients[name], message)
    resume()
  },
  
  expect_no_announce: function(name, message, resume) {
    this.expect(this.engine, "announce").given(this._clients[name], message).exactly(0)
    resume()
  }
})

JS.ENV.EngineSpec = JS.Test.describe("Pub/sub engines", function() { with(this) {
  include(JS.Test.Helpers)
  
  sharedExamplesFor("faye engine", function() { with(this) {
    include(JS.Test.FakeClock)
    include(EngineSteps)
    
    define("options", function() { return {} })
    
    before(function() { with(this) {
      clock.stub()
      create_client("alice")
      create_client("bob")
      create_client("carol")
    }})
    
    after(function() { with(this) {
      sync(clock.method("reset"))
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
      define("options", function() { return {timeout: 1} })
      
      it("removes a client if it does not ping often enough", function() { with(this) {
        clock_tick(2000)
        check_client_exists("alice", false)
      }})
      
      it("prolongs the life of a client", function() { with(this) {
        clock_tick(1000)
        ping("alice")
        clock_tick(1000)
        check_client_exists("alice", true)
        clock_tick(1000)
        check_client_exists("alice", false)
      }})
    }})
    
    describe("destroyClient", function() { with(this) {
      it("removes the given client", function() { with(this) {
        destroy_client("alice")
        check_client_exists("alice", false)
      }})
      
      it("notifies listeners of the destroyed client", function() { with(this) {
        expect_disconnect("alice")
        destroy_client("alice")
      }})

      describe("when the client has subscriptions", function() { with(this) {
        before(function() { with(this) {
          this.message = {"channel": "/messages/foo", "data": "ok"}
          subscribe("alice", "/messages/foo")
        }})
        
        it("stops the client receiving messages", function() { with(this) {
          expect(engine, "announce").exactly(0)
          destroy_client("alice")
          publish(message)
        }})
      }})
    }})
    
    describe("publish", function() { with(this) {
      before(function() { with(this) {
        this.message = {"channel": "/messages/foo", "data": "ok"}
      }})
      
      describe("with no subscriptions", function() { with(this) {
        it("delivers no messages", function() { with(this) {
          expect(engine, "announce").exactly(0)
          engine.publish(message)
        }})
      }})
      
      describe("with a subscriber", function() { with(this) {
        before(function() { with(this) {
          subscribe("alice", "/messages/foo")
        }})
        
        it("delivers messages to the subscribed client", function() { with(this) {
          expect_announce("alice", message)
          publish(message)
        }})
      }})
      
      describe("with a subscriber that is removed", function() { with(this) {
        before(function() { with(this) {
          subscribe("alice", "/messages/foo")
          unsubscribe("alice", "/messages/foo")
        }})
        
        it("does not deliver messages to unsubscribed clients", function() { with(this) {
          expect(engine, "announce").exactly(0)
          engine.publish(message)
        }})
      }})
      
      describe("with multiple subscribers", function() { with(this) {
        before(function() { with(this) {
          subscribe("alice", "/messages/foo")
          subscribe("bob",   "/messages/bar")
          subscribe("carol", "/messages/foo")
        }})
        
        it("delivers messages to the subscribed clients", function() { with(this) {
          expect_announce("alice", message)
          expect_no_announce("bob", message)
          expect_announce("carol", message)
          publish(message)
        }})
      }})
      
      describe("with a single wildcard", function() { with(this) {
        before(function() { with(this) {
          subscribe("alice", "/messages/*")
          subscribe("bob",   "/messages/bar")
          subscribe("carol", "/*")
        }})
        
        it("delivers messages to matching subscriptions", function() { with(this) {
          expect_announce("alice", message)
          expect_no_announce("bob", message)
          expect_no_announce("carol", message)
          publish(message)
        }})
      }})
      
      describe("with a double wildcard", function() { with(this) {
        before(function() { with(this) {
          subscribe("alice", "/messages/**")
          subscribe("bob",   "/messages/bar")
          subscribe("carol", "/**")
        }})
        
        it("delivers messages to matching subscriptions", function() { with(this) {
          expect_announce("alice", message)
          expect_no_announce("bob", message)
          expect_announce("carol", message)
          publish(message)
        }})
      }})
    }})
  }})
  
  describe("Faye.Engine.Memory", function() { with(this) {
    before(function() { this.engine = new Faye.Engine.Memory(this.options()) })
    itShouldBehaveLike("faye engine")
  }})
}})
