var jstest = require("jstest").Test

var copyObject = require("../../../src/util/copy_object")

jstest.describe("copyObject", function() { with(this) {
  before(function() { with(this) {
    this.object = {foo: "bar", qux: 42, hey: null, obj: {bar: 67}}
  }})

  it("returns an equal object", function() { with(this) {
    assertEqual( {foo: "bar", qux: 42, hey: null, obj: {bar: 67}},
                 copyObject(object) )
  }})

  it("does not return the same object", function() { with(this) {
    assertNotSame( object, copyObject(object) )
  }})

  it("performs a deep clone", function() { with(this) {
    assertNotSame( object.obj, copyObject(object).obj )
  }})
}})
