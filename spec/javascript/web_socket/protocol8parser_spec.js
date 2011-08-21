WebSocket = JS.ENV.WebSocket || {}

WebSocket.Protocol8ParserSpec = JS.Test.describe("WebSocket.Protocol8Parser", function() { with(this) {
  before(function() { with(this) {
    this.webSocket = {}
    this.parser = new Faye.WebSocket.Protocol8Parser(webSocket)
  }})
  
  define("parse", function() {
    var bytes = [];
    for (var i = 0, n = arguments.length; i < n; i++) bytes = bytes.concat(arguments[i])
    this.parser.parse(new Buffer(bytes))
  })
  
  describe("parse", function() { with(this) {
    define("mask", function() {
      return this._mask = this._mask || Faye.map([1,2,3,4], function() { return Math.floor(Math.random() * 255) })
    })
    
    define("maskMessage", function(bytes) {
      var output = []
      Array.prototype.forEach.call(bytes, function(b, i) {
        output[i] = bytes[i] ^ this.mask()[i % 4]
      }, this)
      return output
    })
    
    it("parses unmasked text frames", function() { with(this) {
      expect(webSocket, "receive").given("Hello")
      parse([0x81, 0x05, 0x48, 0x65, 0x6c, 0x6c, 0x6f])
    }})
    
    it("parses fragmented text frames", function() { with(this) {
      expect(webSocket, "receive").given("Hello")
      parse([0x01, 0x03, 0x48, 0x65, 0x6c])
      parse([0x80, 0x02, 0x6c, 0x6f])
    }})
    
    it("parses masked text frames", function() { with(this) {
      expect(webSocket, "receive").given("Hello")
      parse([0x81, 0x85], mask(), maskMessage([0x48, 0x65, 0x6c, 0x6c, 0x6f]))
    }})
    
    it("closes the socket if the length is too large", function() { with(this) {
      expect(webSocket, "send").given("", "close", "protocol_error")
      parse([0x81, 0x06, 0x48, 0x65, 0x6c, 0x6c, 0x6f])
    }})
    
    it("closes the socket if the length is too small", function() { with(this) {
      expect(webSocket, "send").given("", "close", "protocol_error")
      parse([0x81, 0x04, 0x48, 0x65, 0x6c, 0x6c, 0x6f])
    }})
    
    it("closes the socket if masking is set on an unmasked message", function() { with(this) {
      expect(webSocket, "send").given("", "close", "protocol_error")
      parse([0x81, 0x84, 0x48, 0x65, 0x6c, 0x6c, 0x6f])
    }})
    
    it("closes the socket if masking is not set on a masked message", function() { with(this) {
      expect(webSocket, "send").given("", "close", "protocol_error")
      parse([0x81, 0x05], mask(), maskMessage([0x48, 0x65, 0x6c, 0x6c, 0x6f]))
    }})
    
    it("parses unmasked multibyte text frames", function() { with(this) {
      expect(webSocket, "receive").given("Apple = ")
      parse([0x81, 0x0b, 0x41, 0x70, 0x70, 0x6c, 0x65, 0x20, 0x3d, 0x20, 0xef, 0xa3, 0xbf])
    }})
    
    it("parses fragmented multibyte text frames", function() { with(this) {
      expect(webSocket, "receive").given("Apple = ")
      parse([0x01, 0x0a, 0x41, 0x70, 0x70, 0x6c, 0x65, 0x20, 0x3d, 0x20, 0xef, 0xa3])
      parse([0x80, 0x01, 0xbf])
    }})
    
    it("parses masked multibyte text frames", function() { with(this) {
      expect(webSocket, "receive").given("Apple = ")
      parse([0x81, 0x8b], mask(), maskMessage([0x41, 0x70, 0x70, 0x6c, 0x65, 0x20, 0x3d, 0x20, 0xef, 0xa3, 0xbf]))
    }})
    
    it("parses unmasked medium-length text frames", function() { with(this) {
      expect(webSocket, "receive").given("HelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHello")
      parse([129, 126, 0, 200, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111])
    }})
    
    it("parses masked medium-length text frames", function() { with(this) {
      expect(webSocket, "receive").given("HelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHello")
      parse([129, 254, 0, 200], mask(), maskMessage([72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111]))
    }})
    
    it("replies to pings with a pong", function() { with(this) {
      expect(webSocket, "send").given("OHAI", "pong")
      parse([0x89, 0x04, 0x4f, 0x48, 0x41, 0x49])
    }})
  }})
  
  describe("frame", function() { with(this) {
    before(function() { this.socket = new FakeSocket })
    
    it("returns the given string formatted as a WebSocket frame", function() { with(this) {
      parser.frame(socket, "Hello")
      assertEqual( [0x81, 0x05, 0x48, 0x65, 0x6c, 0x6c, 0x6f], socket.read() )
    }})
    
    it("encodes multibyte characters correctly", function() { with(this) {
      parser.frame(socket, "Apple = ")
      assertEqual( [0x81, 0x0b, 0x41, 0x70, 0x70, 0x6c, 0x65, 0x20, 0x3d, 0x20, 0xef, 0xa3, 0xbf], socket.read() )
    }})
    
    it("encodes medium-length strings using extra length bytes", function() { with(this) {
      parser.frame(socket, "HelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHelloHello")
      assertEqual( [129, 126, 0, 200, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111, 72, 101, 108, 108, 111], socket.read() )
    }})
    
    it("encodes long strings using extra length bytes", function() { with(this) {
      var reps = 13108, message = '', output = [0x81, 0x7f, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x04]
      while (reps--) {
        message += "Hello"
        output = output.concat([0x48, 0x65, 0x6c, 0x6c, 0x6f])
      }
      parser.frame(socket, message)
      assertEqual( output, socket.read() )
    }})
    
    it("encodes close frames with an error code", function() { with(this) {
      parser.frame(socket, "Hello", "close", "protocol_error")
      assertEqual( [0x88, 0x07, 0x03, 0xea, 0x48, 0x65, 0x6c, 0x6c, 0x6f], socket.read() )
    }})
    
    it("encodes pong frames", function() { with(this) {
      parser.frame(socket, "", "pong")
      assertEqual( [0x8a, 0x00], socket.read() )
    }})
  }})
}})
