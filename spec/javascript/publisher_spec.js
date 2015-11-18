var jstest = require("jstest").Test

var Publisher = require("../../javascript/mixins/publisher"),
    extend_   = require("../../javascript/util/extend")

jstest.describe("Publisher", function() { with(this) {
  before(function() { with(this) {
    this.publisher = extend_({}, Publisher)
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
