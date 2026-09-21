var jstest = require("jstest").Test

var Deferrable = require("../../../src/mixins/deferrable")

// Node only: it asserts on process-level unhandled rejections, so it is deliberately absent
// from spec/browser.js.
jstest.describe("Deferrable", function() { with(this) {
  before(function() { with(this) {
    this.deferrable  = Object.assign({}, Deferrable)
    this.rejections  = []
    this.onRejection = function(reason) { rejections.push(reason) }
    process.on("unhandledRejection", this.onRejection)
  }})

  after(function() { with(this) {
    process.removeListener("unhandledRejection", onRejection)
  }})

  // gives the platform a turn to report any rejection left unobserved
  define("settle", function(callback) {
    setTimeout(callback, 10)
  })

  describe("when it fails with nobody listening", function() { with(this) {
    it("does not report an unhandled rejection", function(resume) { with(this) {
      deferrable.setDeferredStatus("failed", new Error("boom"))
      settle(function() { resume(function() { assertEqual( [], rejections ) }) })
    }})
  }})

  describe("when it fails with a callback attached", function() { with(this) {
    before(function() { with(this) {
      this.fired = []
      deferrable.callback(function(value) { fired.push(value) })
      deferrable.errback(function(reason) { fired.push(reason) })
    }})

    it("does not report an unhandled rejection", function(resume) { with(this) {
      deferrable.setDeferredStatus("failed", new Error("boom"))
      settle(function() { resume(function() { assertEqual( [], rejections ) }) })
    }})

    it("still runs the errback", function(resume) { with(this) {
      deferrable.setDeferredStatus("failed", new Error("boom"))
      settle(function() { resume(function() { assertEqual( 1, fired.length ) }) })
    }})
  }})

  describe("when it fails with no value", function() { with(this) {
    it("does not report an unhandled rejection", function(resume) { with(this) {
      deferrable.callback(function() {})
      deferrable.setDeferredStatus("failed")
      settle(function() { resume(function() { assertEqual( [], rejections ) }) })
    }})
  }})

  describe("when it succeeds", function() { with(this) {
    it("still runs the callback", function(resume) { with(this) {
      var received = []
      deferrable.callback(function(value) { received.push(value) })
      deferrable.setDeferredStatus("succeeded", 42)
      settle(function() { resume(function() { assertEqual( [42], received ) }) })
    }})
  }})
}})
