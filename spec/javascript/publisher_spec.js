JS.ENV.PublisherSpec = JS.Test.describe("Publisher", function() { with(this) {
  before(function() { with(this) {
    this.publisher = Faye.extend({}, Faye.Publisher)
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

