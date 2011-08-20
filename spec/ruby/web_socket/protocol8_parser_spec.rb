# encoding=utf-8

require "spec_helper"

describe Faye::WebSocket::Protocol8Parser do
  before do
    @web_socket = mock Faye::WebSocket
    @parser = Faye::WebSocket::Protocol8Parser.new(@web_socket)
  end
  
  describe :frame do
    it "returns the given string formatted as a WebSocket frame" do
      bytes(@parser.frame "Hello").should == [0x81, 0x05, 0x48, 0x65, 0x6c, 0x6c, 0x6f]
    end
    
    it "encodes multibyte characters correctly" do
      string = "Apple = "
      string.force_encoding("UTF-8") if string.respond_to?(:force_encoding)
      bytes(@parser.frame string).should == [0x81, 0x0b, 0x41, 0x70, 0x70, 0x6c, 0x65, 0x20, 0x3d, 0x20, 0xef, 0xa3, 0xbf]
    end
    
    it "encodes medium-length strings using extra length bytes" do
      string = "Hello" * 40
      bytes(@parser.frame string).should == [0x81, 0x7e, 0x00, 0xc8] + [0x48, 0x65, 0x6c, 0x6c, 0x6f] * 40
    end
    
    it "encodes long strings using extra length bytes" do
      string = "Hello" * 13108
      bytes(@parser.frame string).should == [0x81, 0x7f] +
                                            [0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x04] +
                                            [0x48, 0x65, 0x6c, 0x6c, 0x6f] * 13108
    end
    
    it "encodes close frames with an error code" do
      frame = @parser.frame "Hello", :close, :protocol_error
      bytes(frame).should == [0x88, 0x7, 0x03, 0xea, 0x48, 0x65, 0x6c, 0x6c, 0x6f]
    end
    
    it "encodes pong frames" do
      bytes(@parser.frame '', :pong).should == [0x8a, 0x00]
    end
  end
end
