WebSocket = JS.ENV.WebSocket || {}

WebSocket.Draft75ParserSpec = JS.Test.describe("WebSocket.Draft75Parser", function() { with(this) {
  before(function() { with(this) {
    this.webSocket = {}
    this.parser = new Faye.WebSocket.Draft75Parser(webSocket)
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
  }})
  
  describe("frame", function() { with(this) {
    before(function() { this.socket = new FakeSocket })
    
    it("returns the given string formatted as a WebSocket frame", function() { with(this) {
      parser.frame(socket, "Hello")
      assertEqual( [0x00, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0xff], socket.read() )
    }})
    
    it("encodes multibyte characters correctly", function() { with(this) {
      parser.frame(socket, "Apple = ")
      assertEqual( [0x00, 0x41, 0x70, 0x70, 0x6c, 0x65, 0x20, 0x3d, 0x20, 0xef, 0xa3, 0xbf, 0xff], socket.read() )
    }})
  }})
}})
