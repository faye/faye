EngineSpec = JS.Test.describe("Pub/sub engines", function() {
  include(JS.Test.Helpers)
  
  sharedExamplesFor("faye engine", function() {
    define("makeClientId", function() {
      var clientId = null
      this.engine.createClientId(function(id) { clientId = id })
      return clientId
    })
    
    define("options", function() { return {} })
    
    before(function() {
      this.alice = makeClientId()
      this.bob   = makeClientId()
      this.cecil = makeClientId()
    })
    
    describe("createClientId", function() {
      it("returns a client id", function() {
        engine.createClientId(function(id) {
          assert( id )
          assertMatch( /^[a-z0-9]+$/, id )
        })
      })
      
      it("returns a different id every time", function() {
        var ids = new JS.Set()
        $R(1,10).forEach(function(i) { engine.createClientId(ids.method('add')) })
        assertEqual( 10, ids.count() )
      })
    })
    
    describe("clientExists", function() {
      it("returns true if the client id exists", function() {
        engine.clientExists(alice, assertYield(true))
      })
      
      it("returns false if the client id does not exist", function() {
        engine.clientExists("anything", assertYield(false))
      })
    })
    
    describe("ping", function() {
      define("options", function() { return {timeout: 1} })
      
      it("removes a client if it does not ping often enough", function(resume) {
        engine.clientExists(alice, assertYield(true))
        setTimeout(function() {
          resume(function() { engine.clientExists(alice, assertYield(false)) })
        }, 2500)
      })
      
      it("prolongs the life of a client", function(resume) {
        engine.clientExists(alice, assertYield(true))
        setTimeout(function() {
          engine.ping(alice)
          setTimeout(function() {
            resume(function() { engine.clientExists(alice, assertYield(true)) })
          }, 1000)
        }, 1500)
      })
    })
    
    describe("disconnect", function() {
      it("removes the given client", function() {
        engine.disconnect(alice)
        engine.clientExists(alice, assertYield(false))
      })
      
      describe("when the client has subscriptions", function() {
        before(function() {
          this.inbox = {}
          this.message = {'channel': '/messages/foo', 'data': 'ok'}
          
          engine.onMessage(function(clientId, message) {
            inbox[clientId] = inbox[clientId] || []
            inbox[clientId].push(message)
          })
          engine.subscribe(alice, "/messages/foo")
        })
        
        it("stops the client receiving messages", function() {
          engine.disconnect(alice)
          engine.distribute(message)
          assertEqual( {}, inbox )
        })
      })
    })
    
    describe("distribute", function() {
      before(function() {
        this.inbox = {}
        this.message = {'channel': '/messages/foo', 'data': 'ok'}
        
        engine.onMessage(function(clientId, message) {
          inbox[clientId] = inbox[clientId] || []
          inbox[clientId].push(message)
        })
      })
      
      describe("with no subscriptions", function() {
        it("delivers no messages", function() {
          engine.distribute(message)
          assertEqual( {}, inbox )
        })
      })
      
      describe("with a subscriber", function() {
        before(function() {
          engine.subscribe(alice, "/messages/foo")
        })
        
        it("delivers messages to the subscribed client", function() {
          engine.distribute(message)
          assertEqual( [message], inbox[alice] )
        })
      })
      
      describe("with a subscriber that is removed", function() {
        before(function() {
          engine.subscribe(alice, "/messages/foo")
          engine.unsubscribe(alice, "/messages/foo")
        })
        
        it("does not deliver messages to unsubscribed clients", function() {
          engine.distribute(message)
          assertEqual( {}, inbox )
        })
      })
      
      describe("with multiple subscribers", function() {
        before(function() {
          engine.subscribe(alice, "/messages/foo")
          engine.subscribe(bob,   "/messages/bar")
          engine.subscribe(cecil, "/messages/foo")
        })
        
        it("delivers messages to the subscribed clients", function() {
          engine.distribute(message)
          assertEqual( [message], inbox[alice] )
          assertEqual( undefined, inbox[bob]   )
          assertEqual( [message], inbox[cecil] )
        })
      })
      
      describe("with a single wildcard", function() {
        before(function() {
          engine.subscribe(alice, "/messages/*")
          engine.subscribe(bob,   "/messages/bar")
          engine.subscribe(cecil, "/*")
        })
        
        it("delivers messages to matching subscriptions", function() {
          engine.distribute(message)
          assertEqual( [message], inbox[alice] )
          assertEqual( undefined, inbox[bob]   )
          assertEqual( undefined, inbox[cecil] )
        })
      })
      
      describe("with a double wildcard", function() {
        before(function() {
          engine.subscribe(alice, "/messages/**")
          engine.subscribe(bob,   "/messages/bar")
          engine.subscribe(cecil, "/**")
        })
        
        it("delivers messages to matching subscriptions", function() {
          engine.distribute(message)
          assertEqual( [message], inbox[alice] )
          assertEqual( undefined, inbox[bob]   )
          assertEqual( [message], inbox[cecil] )
        })
      })
    })
  })
  
  describe("Faye.Engine.Memory", function() {
    before(function() { this.engine = new Faye.Engine.Memory(this.options()) })
    itShouldBehaveLike("faye engine")
  })
})

