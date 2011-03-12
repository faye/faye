JS.ENV.ChannelSpec = JS.Test.describe("Channel", function() { with(this) {
  describe("expand", function() { with(this) {
    it("returns all patterns that match a channel", function() { with(this) {
      
      assertEqual( ["/**", "/foo", "/*"],
                   Faye.Channel.expand("/foo") )
      
      assertEqual( ["/**", "/foo/bar", "/foo/*", "/foo/**"],
                   Faye.Channel.expand("/foo/bar") )
      
      assertEqual( ["/**", "/foo/bar/qux", "/foo/bar/*", "/foo/**", "/foo/bar/**"],
                   Faye.Channel.expand("/foo/bar/qux") )
    }})
  }})
}})
