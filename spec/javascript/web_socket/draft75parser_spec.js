JS.ENV.WebSocket = JS.ENV.WebSocket || {}

JS.ENV.WebSocket.Draft75ParserSpec = JS.Test.describe("WebSocket.Draft75Parser", function() { with(this) {
  before(function() { with(this) {
    this.webSocket = {dispatchEvent: function() {}}
    this.socket = new FakeSocket
    this.parser = new Faye.WebSocket.Draft75Parser(webSocket, socket)
  }})
  
  describe("parse", function() { with(this) {
    it("parses text frames", function() { with(this) {
      expect(webSocket, "receive").given("Hello")
      parser.parse([0x00, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0xff])
    }})
    
    it("parses multibyte text frames", function() { with(this) {
      expect(webSocket, "receive").given("Apple = ")
      parser.parse([0x00, 0x41, 0x70, 0x70, 0x6c, 0x65, 0x20, 0x3d, 0x20, 0xef, 0xa3, 0xbf, 0xff])
    }})
    
    it("parses fragmented frames", function() { with(this) {
      expect(webSocket, "receive").given("Hello")
      parser.parse([0x00, 0x48, 0x65, 0x6c])
      parser.parse([0x6c, 0x6f, 0xff])
    }})
  }})
  
  describe("frame", function() { with(this) {
    it("returns the given string formatted as a WebSocket frame", function() { with(this) {
      parser.frame("Hello")
      assertEqual( [0x00, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0xff], socket.read() )
    }})
    
    it("encodes multibyte characters correctly", function() { with(this) {
      parser.frame("Apple = ")
      assertEqual( [0x00, 0x41, 0x70, 0x70, 0x6c, 0x65, 0x20, 0x3d, 0x20, 0xef, 0xa3, 0xbf, 0xff], socket.read() )
    }})
  }})
}})
