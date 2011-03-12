JS.ENV.EngineSpec = JS.Test.describe("Pub/sub engines", function() { with(this) {
  include(JS.Test.Helpers)
  
  sharedExamplesFor("faye engine", function() { with(this) {
    include(JS.Test.FakeClock)
    
    define("makeClientId", function() {
      var clientId = null
      this.engine.createClient(function(id) { clientId = id })
      return clientId
    })
    
    define("options", function() { return {} })
    
    before(function() { with(this) {
      this.clock.stub()
      this.alice = makeClientId()
      this.bob   = makeClientId()
      this.cecil = makeClientId()
    }})
    
    after(function() { with(this) {
      this.clock.reset()
    }})
    
    describe("createClient", function() { with(this) {
      it("returns a client id", function() { with(this) {
        engine.createClient(function(id) {
          assert( id )
          assertMatch( /^[a-z0-9]+$/, id )
        })
      }})
      
      it("returns a different id every time", function() { with(this) {
        var ids = new JS.Set()
        $R(1,10).forEach(function(i) { engine.createClient(ids.method('add')) })
        assertEqual( 10, ids.count() )
      }})
    }})
    
    describe("clientExists", function() { with(this) {
      it("returns true if the client id exists", function() { with(this) {
        engine.clientExists(alice, assertYield(true))
      }})
      
      it("returns false if the client id does not exist", function() { with(this) {
        engine.clientExists("anything", assertYield(false))
      }})
    }})
    
    describe("ping", function() { with(this) {
      define("options", function() { return {timeout: 1} })
      
      it("removes a client if it does not ping often enough", function() { with(this) {
        clock.tick(2000)
        engine.clientExists(alice, assertYield(false))
      }})
      
      it("prolongs the life of a client", function() { with(this) {
        clock.tick(1000)
        engine.ping(alice)
        clock.tick(1000)
        engine.clientExists(alice, assertYield(true))
      }})
    }})
    
    describe("destroyClient", function() { with(this) {
      it("removes the given client", function() { with(this) {
        engine.destroyClient(alice)
        engine.clientExists(alice, assertYield(false))
      }})
      
      describe("when the client has subscriptions", function() { with(this) {
        before(function() { with(this) {
          this.inbox = {}
          this.message = {'channel': '/messages/foo', 'data': 'ok'}
          
          engine.addSubscriber('messsage', function(clientId, message) {
            inbox[clientId] = inbox[clientId] || []
            inbox[clientId].push(message)
          })
          engine.subscribe(alice, "/messages/foo")
        }})
        
        it("stops the client receiving messages", function() { with(this) {
          engine.destroyClient(alice)
          engine.distribute(message)
          assertEqual( {}, inbox )
        }})
      }})
    }})
    
    describe("distribute", function() { with(this) {
      before(function() { with(this) {
        this.inbox = {}
        this.message = {'channel': '/messages/foo', 'data': 'ok'}
        
        engine.addSubscriber('message', function(clientId, message) {
          inbox[clientId] = inbox[clientId] || []
          inbox[clientId].push(message)
        })
      }})
      
      describe("with no subscriptions", function() { with(this) {
        it("delivers no messages", function() { with(this) {
          engine.distribute(message)
          assertEqual( {}, inbox )
        }})
      }})
      
      describe("with a subscriber", function() { with(this) {
        before(function() { with(this) {
          engine.subscribe(alice, "/messages/foo")
        }})
        
        it("delivers messages to the subscribed client", function() { with(this) {
          engine.distribute(message)
          assertEqual( [message], inbox[alice] )
        }})
      }})
      
      describe("with a subscriber that is removed", function() { with(this) {
        before(function() { with(this) {
          engine.subscribe(alice, "/messages/foo")
          engine.unsubscribe(alice, "/messages/foo")
        }})
        
        it("does not deliver messages to unsubscribed clients", function() { with(this) {
          engine.distribute(message)
          assertEqual( {}, inbox )
        }})
      }})
      
      describe("with multiple subscribers", function() { with(this) {
        before(function() { with(this) {
          engine.subscribe(alice, "/messages/foo")
          engine.subscribe(bob,   "/messages/bar")
          engine.subscribe(cecil, "/messages/foo")
        }})
        
        it("delivers messages to the subscribed clients", function() { with(this) {
          engine.distribute(message)
          assertEqual( [message], inbox[alice] )
          assertEqual( undefined, inbox[bob]   )
          assertEqual( [message], inbox[cecil] )
        }})
      }})
      
      describe("with a single wildcard", function() { with(this) {
        before(function() { with(this) {
          engine.subscribe(alice, "/messages/*")
          engine.subscribe(bob,   "/messages/bar")
          engine.subscribe(cecil, "/*")
        }})
        
        it("delivers messages to matching subscriptions", function() { with(this) {
          engine.distribute(message)
          assertEqual( [message], inbox[alice] )
          assertEqual( undefined, inbox[bob]   )
          assertEqual( undefined, inbox[cecil] )
        }})
      }})
      
      describe("with a double wildcard", function() { with(this) {
        before(function() { with(this) {
          engine.subscribe(alice, "/messages/**")
          engine.subscribe(bob,   "/messages/bar")
          engine.subscribe(cecil, "/**")
        }})
        
        it("delivers messages to matching subscriptions", function() { with(this) {
          engine.distribute(message)
          assertEqual( [message], inbox[alice] )
          assertEqual( undefined, inbox[bob]   )
          assertEqual( [message], inbox[cecil] )
        }})
      }})
    }})
  }})
  
  describe("Faye.Engine.Memory", function() { with(this) {
    before(function() { this.engine = new Faye.Engine.Memory(this.options()) })
    itShouldBehaveLike("faye engine")
  }})
}})
