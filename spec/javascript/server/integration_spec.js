var fs    = require("fs"),
    http  = require("http"),
    https = require("https"),
    cert  = fs.readFileSync(__dirname + "/../../../examples/server.crt"),
    key   = fs.readFileSync(__dirname + "/../../../examples/server.key")

var jstest = require("jstest").Test

var NodeAdapter        = require("../../../src/adapters/node_adapter"),
    Client             = require("../../../src/protocol/client"),
    WebSocketTransport = require("../../../src/transport/web_socket")

var IntegrationSteps = jstest.asyncSteps({
  server: function(ssl, callback) {
    this._adapter = new NodeAdapter({mount: "/bayeux", timeout: 2})

    this._adapter.addExtension({
      incoming: function(message, callback) {
        if (message.data) message.data.tagged = true
        callback(message)
      },

      outgoing: function(message, request, callback) {
        if (message.data) message.data.url = request.url;
        callback(message)
      }
    })

    this._secure = ssl

    this._http = ssl
               ? https.createServer({cert: cert, key: key})
               : http.createServer()

    this._adapter.attach(this._http)
    var self = this

    this._http.listen(0, function() {
      self._port = self._http.address().port
      callback()
    })
  },

  stop: function(callback) {
    this._http.close()
    callback()
  },

  client: function(name, channels, callback) {
    var scheme          = this._secure ? "https" : "http"
    this._clients       = this._clients || {}
    this._inboxes       = this._inboxes || {}
    this._clients[name] = new Client(scheme + "://localhost:" + this._port  + "/bayeux", {ca: cert})
    this._inboxes[name] = {}

    var n = channels.length
    if (n === 0) return this._clients[name].connect(callback)

    for (var i = 0; i < n; i++)
      (function(channel) {
        var subscription = this._clients[name].subscribe(channel, function(message) {
          this._inboxes[name][channel] = this._inboxes[name][channel] || []
          this._inboxes[name][channel].push(message)
        }, this)
        subscription.callback(function() {
          n -= 1
          if (n === 0) callback()
        })
      }).call(this, channels[i]);
  },

  publish: function(name, channel, message, callback) {
    this._clients[name].publish(channel, message)
    setTimeout(callback, 100)
  },

  check_inbox: function(name, channel, messages, callback) {
    var inbox = this._inboxes[name][channel] || []
    this.assertEqual(messages, inbox)
    callback()
  }
})

jstest.describe("Server integration", function() { with(this) {
  include(IntegrationSteps)

  sharedExamplesFor("message bus", function() { with(this) {
    before(function() { with(this) {
      server(serverOptions.ssl)
      client("alice", [])
      client("bob", ["/foo"])
    }})

    after(function() { this.stop() })

    it("delivers a message between clients", function() { with(this) {
      publish("alice", "/foo", {hello: "world", extra: null})
      check_inbox("bob", "/foo", [{hello: "world", extra: null, tagged: true, url: "/bayeux"}])
    }})

    it("does not deliver messages for unsubscribed channels", function() { with(this) {
      publish("alice", "/bar", {hello: "world"})
      check_inbox("bob", "/foo", [])
    }})

    it("delivers multiple messages", function() { with(this) {
      publish("alice", "/foo", {hello: "world"})
      publish("alice", "/foo", {hello: "world"})
      check_inbox("bob", "/foo", [{hello: "world", tagged: true, url: "/bayeux"}, {hello: "world", tagged: true, url: "/bayeux"}])
    }})

    it("delivers multibyte strings", function() { with(this) {
      publish("alice", "/foo", {hello: "Apple = "})
      check_inbox("bob", "/foo", [{hello: "Apple = ", tagged: true, url: "/bayeux"}])
    }})
  }})

  sharedExamplesFor("network transports", function() { with(this) {
    describe("with HTTP transport", function() { with(this) {
      before(function() { with(this) {
        stub(WebSocketTransport, "isUsable").yields([false])
      }})

      itShouldBehaveLike("message bus")
    }})

    describe("with WebSocket transport", function() { with(this) {
      before(function() { with(this) {
        stub(WebSocketTransport, "isUsable").yields([true])
      }})

      itShouldBehaveLike("message bus")
    }})
  }})

  describe("with HTTP server", function() { with(this) {
    before(function() { with(this) {
      this.serverOptions = {ssl: false}
    }})

    itShouldBehaveLike("network transports")
  }})

  describe("with HTTPS server", function() { with(this) {
    before(function() { with(this) {
      this.serverOptions = {ssl: true}
    }})

    itShouldBehaveLike("network transports")
  }})
}})
