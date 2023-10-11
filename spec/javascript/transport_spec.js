var jstest = require("jstest").Test

var Transport = require("../../src/transport"),
    Class     = require("../../src/util/class"),
    URI       = require("../../src/util/uri"),
    array     = require("../../src/util/array")

jstest.describe("Transport", function() { with(this) {
  before(function() { with(this) {
    this.dispatcher = {
      endpoint:       URI.parse("http://example.com/"),
      endpoints:      {},
      maxRequestSize: 2048,
      headers:        {},
      proxy:          {},
      transports:     {},
      wsExtensions:   []
    }
    dispatcher.endpointFor = function() { return dispatcher.endpoint }

    this.websocket       = "websocket"
    this.SocketTransport = array.filter(Transport._transports, function(t) { return t[0] === websocket })[0][1]
    this.longPolling     = "long-polling"
    this.HttpTransport   = array.filter(Transport._transports, function(t) { return t[0] === longPolling })[0][1]
  }})

  describe("get", function() { with(this) {
    before(function() { with(this) {
      stub(HttpTransport, "isUsable").yields([false])
      stub(SocketTransport, "isUsable").yields([false])
    }})

    describe("when no transport is usable", function() { with(this) {
      it("raises an exception", function() { with(this) {
        assertThrows(Error, function() { Transport.get(dispatcher, [longPolling, websocket], []) })
      }})
    }})

    describe("when a less preferred transport is usable", function() { with(this) {
      before(function() { with(this) {
        stub(HttpTransport, "isUsable").yields([true])
      }})

      it("returns a transport of the usable type", function() { with(this) {
        Transport.get(dispatcher, [longPolling, websocket], [], function(transport) {
          assertKindOf( HttpTransport, transport )
        })
      }})

      it("raises an exception if the usable type is not requested", function() { with(this) {
        assertThrows(Error, function() { Transport.get(dispatcher, [websocket], []) })
      }})

      it("allows the usable type to be specifically selected", function() { with(this) {
        Transport.get(dispatcher, [longPolling], [], function(transport) {
          assertKindOf( HttpTransport, transport )
        })
      }})
    }})

    describe("when all transports are usable", function() { with(this) {
      before(function() { with(this) {
        stub(SocketTransport, "isUsable").yields([true])
        stub(HttpTransport, "isUsable").yields([true])
      }})

      it("returns the most preferred type", function() { with(this) {
        Transport.get(dispatcher, [longPolling, websocket], [], function(transport) {
          assertKindOf( SocketTransport, transport )
        })
      }})

      it("does not return disabled types", function() { with(this) {
        Transport.get(dispatcher, [longPolling, websocket], [websocket], function(transport) {
          assertKindOf( HttpTransport, transport )
        })
      }})

      it("allows types to be specifically selected", function() { with(this) {
        Transport.get(dispatcher, [websocket], [], function(transport) {
          assertKindOf( SocketTransport, transport )
        })
        Transport.get(dispatcher, [longPolling], [], function(transport) {
          assertKindOf( HttpTransport, transport )
        })
      }})
    }})
  }})

  describe("sendMessage", function() { with(this) {
    include(jstest.FakeClock)
    before(function() { this.clock.stub() })
    after(function() { this.clock.reset() })

    define("sendMessage", function(message) {
      this.transport.sendMessage(message)
    })

    describe("for batching transports", function() { with(this) {
      before(function() { with(this) {
        this.Transport = Class(Transport, { batching: true })
        this.transport = new Transport(dispatcher, dispatcher.endpoint)
      }})

      it("does not make an immediate request", function() { with(this) {
        expect(transport, "request").exactly(0)
        sendMessage({ batch: "me" })
      }})

      it("queues the message to be sent after a timeout", function() { with(this) {
        expect(transport, "request").given([{ batch: "me" }]).exactly(1)
        sendMessage({ batch: "me" })
        clock.tick(10)
      }})

      it("allows multiple messages to be batched together", function() { with(this) {
        expect(transport, "request").given([{ id: 1 }, { id: 2 }]).exactly(1)
        sendMessage({ id: 1 })
        sendMessage({ id: 2 })
        clock.tick(10)
      }})

      it("adds advice to connect messages sent with others", function() { with(this) {
        expect(transport, "request").given([{ channel: "/meta/connect", advice: { timeout: 0 }}, {}]).exactly(1)
        sendMessage({ channel: "/meta/connect" })
        sendMessage({})
        clock.tick(10)
      }})

      it("adds no advice to connect messages sent alone", function() { with(this) {
        expect(transport, "request").given([{ channel: "/meta/connect" }]).exactly(1)
        sendMessage({ channel: "/meta/connect" })
        clock.tick(10)
      }})
    }})

    describe("for non-batching transports", function() { with(this) {
      before(function() { with(this) {
        this.Transport = Class(Transport, { batching: false })
        this.transport = new Transport(dispatcher, dispatcher.endpoint)
      }})

      it("makes a request immediately", function() { with(this) {
        expect(transport, "request").given([{ no: "batch" }]).exactly(1)
        sendMessage({ no: "batch" })
        clock.tick(10)
      }})
    }})
  }})
}})
