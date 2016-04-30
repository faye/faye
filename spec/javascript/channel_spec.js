var jstest = require("jstest").Test

var Channel = require("../../src/protocol/channel")

jstest.describe("Channel", function() { with(this) {
  describe("expand", function() { with(this) {
    it("returns all patterns that match a channel", function() { with(this) {

      assertEqual( ["/**", "/foo", "/*"],
                   Channel.expand("/foo") )

      assertEqual( ["/**", "/foo/bar", "/foo/*", "/foo/**"],
                   Channel.expand("/foo/bar") )

      assertEqual( ["/**", "/foo/bar/qux", "/foo/bar/*", "/foo/**", "/foo/bar/**"],
                   Channel.expand("/foo/bar/qux") )
    }})
  }})

  describe("Set", function() { with(this) {
    describe("subscribe", function() { with(this) {
      it("subscribes and unsubscribes without callback", function() { with(this) {
        var channels = new Channel.Set()
        channels.subscribe(["/foo/**"], null)
        assertEqual( ["/foo/**"], channels.getKeys() )
        assert( channels.unsubscribe("/foo/**", null) )
      }})
    }})
  }})
}})
