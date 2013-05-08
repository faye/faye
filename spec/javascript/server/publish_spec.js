JS.ENV.Server.PublishSpec = JS.Test.describe("Server publish", function() { with(this) {
  before(function() { with(this) {
    this.engine = {}
    stub(Faye.Engine, "get").returns(engine)
    this.server = new Faye.Server()

    this.message = {channel: "/some/channel",     data: "publish"}
  }})

  describe("publishing a message", function() { with(this) {
    it("tells the engine to publish the message", function() { with(this) {
      expect(engine, "publish").given(message)
      server.process(message, false, function() {})
    }})

    it("returns a successful response", function() { with(this) {
      stub(engine, "publish")
      server.process(message, false, function(response) {
        assertEqual([
          { channel:    "/some/channel",
            successful: true
          }
        ], response)
      })
    }})

    describe("with an invalid channel", function() { with(this) {
      before(function() { with(this) {
        message.channel = "channel"
      }})

      it("does not tell the engine to publish the message", function() { with(this) {
        expect(engine, "publish").exactly(0)
        server.process(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        stub(engine, "publish")
        server.process(message, false, function(response) {
          assertEqual([
            { channel:    "channel",
              successful: false,
              error:      "405:channel:Invalid channel"
            }
          ], response)
        })
      }})
    }})

    describe("with an error", function() { with(this) {
      before(function() { with(this) {
        message.error = "invalid"
      }})

      it("does not tell the engine to publish the message", function() { with(this) {
        expect(engine, "publish").exactly(0)
        server.process(message, false, function() {})
      }})

      it("returns an unsuccessful response", function() { with(this) {
        stub(engine, "publish")
        server.process(message, false, function(response) {
          assertEqual([
            { channel:    "/some/channel",
              successful: false,
              error:      "invalid"
            }
          ], response)
        })
      }})
    }})

    describe("to an invalid channel", function() { with(this) {
      before(function() { with(this) {
        message.channel = "/invalid/*"
      }})

      it("does not tell the engine to publish the message", function() { with(this) {
        expect(engine, "publish").exactly(0)
        server.process(message, false, function() {})
      }})
    }})
  }})
}})

