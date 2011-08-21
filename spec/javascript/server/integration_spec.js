JS.ENV.IntegrationSteps = JS.Test.asyncSteps({
  server: function(port, callback) {
    this._adapter = new Faye.NodeAdapter({mount: "/bayeux", timeout: 25})
    this._adapter.listen(port)
    this._port = port
    setTimeout(callback, 100)
  },
  
  stop: function(callback) {
    this._adapter.stop()
    setTimeout(callback, 100)
  },
  
  client: function(name, channels, callback) {
    this._clients = this._clients || {}
    this._inboxes = this._inboxes || {}
    this._clients[name] = new Faye.Client("http://0.0.0.0:" + this._port  + "/bayeux")
    this._inboxes[name] = {}
    
    var n = channels.length
    if (n === 0) return callback()
    
    Faye.each(channels, function(channel) {
      var subscription = this._clients[name].subscribe(channel, function(message) {
        this._inboxes[name][channel] = this._inboxes[name][channel] || []
        this._inboxes[name][channel].push(message)
      }, this)
      subscription.callback(function() {
        n -= 1
        if (n === 0) callback()
      })
    }, this)
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

JS.ENV.Server.IntegrationSpec = JS.Test.describe("Server integration", function() { with(this) {
  include(IntegrationSteps)
  
  before(function() { with(this) {
    server(8000)
    client("alice", [])
    client("bob", ["/foo"])
  }})
  
  after(function() { this.stop() })
  
  it("delivers a message between clients", function() { with(this) {
    publish("alice", "/foo", {hello: "world"})
    check_inbox("bob", "/foo", [{hello: "world"}])
  }})
  
  it("does not deliver messages for unsubscribed channels", function() { with(this) {
    publish("alice", "/bar", {hello: "world"})
    check_inbox("bob", "/foo", [])
  }})
  
  it("delivers multiple messages", function() { with(this) {
    publish("alice", "/foo", {hello: "world"})
    publish("alice", "/foo", {hello: "world"})
    check_inbox("bob", "/foo", [{hello: "world"},{hello: "world"}])
  }})
  
  it("delivers multibyte strings", function() { with(this) {
    publish("alice", "/foo", {hello: "Apple = "})
    check_inbox("bob", "/foo", [{hello: "Apple = "}])
  }})
}})
