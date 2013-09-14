JS.ENV.FayeSpec = JS.Test.describe("Faye", function() { with(this) {
  include(JS.Test.Helpers)

  describe("random", function() { with(this) {
    it("returns a 160-bit random number in base 36", function() { with(this) {
      assertMatch( /^[a-z0-9]+$/, Faye.random() )
    }})

    it("always produces the same length of string", function() { with(this) {
      var ids = $R(1,100).map(function() { return Faye.random().length })
      var expected = $R(1,100).map(function() { return 31 })
      assertEqual( expected, ids )
    }})
  }})

  describe("copyObject", function() { with(this) {
    before(function() { with(this) {
      this.object = {foo: "bar", qux: 42, hey: null, obj: {bar: 67}}
    }})

    it("returns an equal object", function() { with(this) {
      assertEqual( {foo: "bar", qux: 42, hey: null, obj: {bar: 67}},
                   Faye.copyObject(object) )
    }})

    it("does not return the same object", function() { with(this) {
      assertNotSame( object, Faye.copyObject(object) )
    }})

    it("performs a deep clone", function() { with(this) {
      assertNotSame( object.obj, Faye.copyObject(object).obj )
    }})
  }})
}})
