EngineSpec = JS.Test.describe("Pub/sub engines", function() {
  include(JS.Test.Helpers)
  
  sharedExamplesFor("faye engine", function() {
    define("makeClientId", function() {
      var clientId = null
      this.engine.createClientId(function(id) { clientId = id })
      return clientId
    })
    
    before(function() {
      this.alice = makeClientId()
      this.bob   = makeClientId()
      this.cecil = makeClientId()
      
      this.options = {timeout: 60}
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
  })
  
  describe("Faye.Engine.Memory", function() {
    before(function() { this.engine = new Faye.Engine.Memory(this.options) })
    itShouldBehaveLike("faye engine")
  })
})

