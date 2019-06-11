var jstest = require("jstest").Test

var Memory = require("../../../src/engines/memory")

require("../engine_spec")

jstest.describe("Memory engine", function() { with(this) {
  before(function() {
    this.engineOpts = { type: Memory }
  })

  itShouldBehaveLike("faye engine")
}})
