var jstest = require("jstest").Test

var Publisher = require("../../src/mixins/publisher"),
    assign    = require("../../src/util/assign")

jstest.describe("Publisher", function() { with(this) {
  before(function() { with(this) {
    this.publisher = assign({}, Publisher)
  }})

  describe("with subscribers that remove themselves", function() { with(this) {
    before(function() { with(this) {
      this.calledA = false
      this.calledB = false

      this.handler = function() {
        calledA = true
        publisher.unbind("event", handler)
      }

      publisher.bind("event", handler)
      publisher.bind("event", function() { calledB = true })
    }})

    it("successfully calls all the callbacks", function() { with(this) {
      publisher.trigger("event")
      assert( calledA )
      assert( calledB )
    }})
  }})
}})
