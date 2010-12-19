ChannelSpec = JS.Test.describe("Faye.Channel", function() {
  describe("expand", function() {
    it("returns all patterns that match a channel", function() {
      assertEqual( ["/**", "/foo", "/*"], Faye.Channel.expand("/foo") )
      assertEqual( ["/**", "/foo/bar", "/foo/*", "/foo/**"], Faye.Channel.expand("/foo/bar") )
      assertEqual( ["/**", "/foo/bar/qux", "/foo/bar/*", "/foo/**", "/foo/bar/**"], Faye.Channel.expand("/foo/bar/qux") )
    })
  })
})

