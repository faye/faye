var jstest = require("jstest").Test,
    Range  = require("jstest").Range

var random = require("../../../javascript/util/random")

jstest.describe("random", function() { with(this) {
  if (typeof document !== "undefined") return

  it("returns a 160-bit random number in base 36", function() { with(this) {
    assertMatch( /^[a-z0-9]+$/, random() )
  }})

  it("always produces the same length of string", function() { with(this) {
    var ids = new Range(1,100).map(function() { return random().length })
    var expected = new Range(1,100).map(function() { return 31 })
    assertEqual( expected, ids )
  }})
}})
