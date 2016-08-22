var jstest = require("jstest").Test

var Engine = require("../../src/engines/proxy"),
    Server = require("../../src/protocol/server")

jstest.describe("Server", function() { with(this) {
  before(function() { with(this) {
    this.engine = {}
    stub(Engine, "get").returns(engine)
    this.server = new Server()
  }})

  describe("#process", function() { with(this) {
    before(function() { with(this) {
      this.handshake   = {channel: "/meta/handshake",   data: "handshake"}
      this.connect     = {channel: "/meta/connect",     data: "connect"}
      this.disconnect  = {channel: "/meta/disconnect",  data: "disconnect"}
      this.subscribe   = {channel: "/meta/subscribe",   data: "subscribe"}
      this.unsubscribe = {channel: "/meta/unsubscribe", data: "unsubscribe"}
      this.publish     = {channel: "/some/channel",     data: "publish"}

      stub(engine, "interval", 0)
      stub(engine, "timeout", 60)
    }})

    it("returns an empty response for no messages", function() { with(this) {
      var response = null
      server.process([], false, function(r) { response = r})
      assertEqual( [], response )
    }})

    it("ignores invalid messages", function() { with(this) {
      var response = null
      server.process([{}, {channel: "invalid"}], false, function(r) { response = r})
      assertEqual([
        { successful: false,
          error:      "402:data:Missing required parameter"
        },
        { channel:    "invalid",
          successful: false,
          error:      "402:data:Missing required parameter"
        }
      ], response)
    }})

    it("rejects unknown meta channels", function() { with(this) {
      var response = null
      server.process([{channel: "/meta/p"}], false, function(r) { response = r })
      assertEqual([
        { channel:    "/meta/p",
          successful: false,
          error:      "403:/meta/p:Forbidden channel"
        }
      ], response)
    }})

    it("routes single messages to appropriate handlers", function() { with(this) {
      expect(server, "handshake").given(handshake, false).yielding([{}])
      server.process(handshake, false, function() {})
    }})

    it("routes a list of messages to appropriate handlers", function() { with(this) {
      expect(server, "handshake").given(handshake, false).yielding([{}])
      expect(server, "connect").given(connect, false).yielding([{}])
      expect(server, "disconnect").given(disconnect, false).yielding([{}])
      expect(server, "subscribe").given(subscribe, false).yielding([{}])
      expect(server, "unsubscribe").given(unsubscribe, false).yielding([{}])

      expect(engine, "publish").given(handshake).exactly(0)
      expect(engine, "publish").given(connect).exactly(0)
      expect(engine, "publish").given(disconnect).exactly(0)
      expect(engine, "publish").given(subscribe).exactly(0)
      expect(engine, "publish").given(unsubscribe).exactly(0)

      expect(engine, "publish").given(publish)

      server.process([handshake, connect, disconnect, subscribe, unsubscribe, publish], false, function() {})
    }})

    describe("handshaking", function() { with(this) {
      before(function() { with(this) {
        expect(server, "handshake").given(handshake, false).yielding([{channel: "/meta/handshake", successful: true}])
      }})

      it("returns the handshake response with advice", function() { with(this) {
        server.process(handshake, false, function(response) {
          assertEqual([
              { channel: "/meta/handshake",
                successful: true,
                advice: {reconnect: "retry", interval: 0, timeout: 60000}
              }
            ], response)
        })
      }})
    }})

    describe("connecting for messages", function() { with(this) {
      before(function() { with(this) {
        this.messages = [{channel: "/a"}, {channel: "/b"}]
        expect(server, "connect").given(connect, false).yielding([messages])
      }})

      it("returns the new messages", function() { with(this) {
        server.process(connect, false, function(response) {
          assertEqual( messages, response )
        })
      }})
    }})
  }})
}})
