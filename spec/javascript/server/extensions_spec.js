var jstest = require("jstest").Test

var Engine = require("../../../src/engines/proxy"),
    Server = require("../../../src/protocol/server")

jstest.describe("Server extensions", function() { with(this) {
    before(function() { with(this) {
    this.engine = {}
    stub(Engine, "get").returns(engine)
    this.server = new Server()
  }})

  describe("with an incoming extension installed", function() { with(this) {
    before(function() { with(this) {
      var extension = {
        incoming: function(message, callback) {
          message.ext = { auth: "password" }
          callback(message)
        }
      }
      server.addExtension(extension)
      this.message = { channel: "/foo", data: "hello" }
    }})

    it("passes incoming messages through the extension", function() { with(this) {
      expect(engine, "publish").given({ channel: "/foo", data: "hello", ext: { auth: "password" }})
      server.process(message, false, function() {})
    }})

    it("does not pass outgoing messages through the extension", function() { with(this) {
      stub(server, "handshake").yields([message])
      stub(engine, "publish")
      var response = null
      server.process({ channel: "/meta/handshake" }, false, function(r) { response = r })
      assertEqual( [{ channel: "/foo", data: "hello" }], response )
    }})
  }})

  describe("with an outgoing extension installed", function() { with(this) {
    before(function() { with(this) {
      var extension = {
        outgoing: function(message, callback) {
          message.ext = { auth: "password" }
          callback(message)
        }
      }
      server.addExtension(extension)
      this.message = { channel: "/foo", data: "hello" }
    }})

    it("does not pass incoming messages through the extension", function() { with(this) {
      expect(engine, "publish").given({ channel: "/foo", data: "hello" })
      server.process(message, false, function() {})
    }})

    it("passes outgoing messages through the extension", function() { with(this) {
      stub(server, "handshake").yields([message])
      stub(engine, "publish")
      var response = null
      server.process({ channel: "/meta/handshake" }, false, function(r) { response = r })
      assertEqual( [{ channel: "/foo", data: "hello", ext: { auth: "password" }}], response )
    }})
  }})
}})
