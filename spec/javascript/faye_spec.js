JS.ENV.FayeSpec = JS.Test.describe("Faye", function() { with(this) {
  include(JS.Test.Helpers)
  
  describe("random", function() { with(this) {
    it("returns a 128-bit random number in base 36", function() { with(this) {
      assertMatch( /^[a-z0-9]+$/, Faye.random() )
    }})
    
    it("always produces the same length of string", function() { with(this) {
      var ids = $R(1,100).map(function() { return Faye.random().length })
      var expected = $R(1,100).map(function() { return 28 })
      assertEqual( expected, ids )
    }})
  }})
}})
