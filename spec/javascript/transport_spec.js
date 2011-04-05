JS.ENV.TransportSpec = JS.Test.describe("Transport", function() { with(this) {
  before(function() { with(this) {
    this.client = {endpoint: "http://example.com/"}
    
    if (Faye.Transport.NodeLocal) {
      this.LocalTransport = Faye.Transport.NodeLocal
      this.HttpTransport  = Faye.Transport.NodeHttp
      this.inProcess      = "in-process"
      this.longPolling    = "long-polling"
    } else {
      this.LocalTransport = Faye.Transport.WebSocket
      this.HttpTransport  = Faye.Transport.XHR
      this.inProcess      = "websocket"
      this.longPolling    = "long-polling"
    }
  }})
  
  describe("get", function() { with(this) {
    before(function() { with(this) {
      stub(HttpTransport, "isUsable").yields([false])
      stub(LocalTransport, "isUsable").yields([false])
    }})
    
    describe("when no transport is usable", function() { with(this) {
      it("raises an exception", function() { with(this) {
        assertThrows(Error, function() { Faye.Transport.get(client, [longPolling, inProcess]) })
      }})
    }})
    
    describe("when a less preferred transport is usable", function() { with(this) {
      before(function() { with(this) {
        stub(HttpTransport, "isUsable").yields([true])
      }})
      
      it("returns a transport of the usable type", function() { with(this) {
        Faye.Transport.get(client, [longPolling, inProcess], function(transport) {
          assertKindOf( HttpTransport, transport )
        })
      }})
      
      it("raises an exception if the usable type is not requested", function() { with(this) {
        assertThrows(Error, function() { Faye.Transport.get(client, [inProcess]) })
      }})
      
      it("allows the usable type to be specifically selected", function() { with(this) {
        Faye.Transport.get(client, [longPolling], function(transport) {
          assertKindOf( HttpTransport, transport )
        })
      }})
    }})
    
    describe("when all transports are usable", function() { with(this) {
      before(function() { with(this) {
        stub(LocalTransport, "isUsable").yields([true])
        stub(HttpTransport, "isUsable").yields([true])
      }})
      
      it("returns the most preferred type", function() { with(this) {
        Faye.Transport.get(client, [longPolling, inProcess], function(transport) {
          assertKindOf( LocalTransport, transport )
        })
      }})
      
      it("allows types to be specifically selected", function() { with(this) {
        Faye.Transport.get(client, [inProcess], function(transport) {
          assertKindOf( LocalTransport, transport )
        })
        Faye.Transport.get(client, [longPolling], function(transport) {
          assertKindOf( HttpTransport, transport )
        })
      }})
    }})
  }})
}})
