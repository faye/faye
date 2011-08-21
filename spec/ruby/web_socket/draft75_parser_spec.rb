# encoding=utf-8

require "spec_helper"

describe Faye::WebSocket::Draft75Parser do
  include EncodingHelper
  
  before do
    @web_socket = mock Faye::WebSocket
    @parser = Faye::WebSocket::Draft75Parser.new(@web_socket)
  end
  
  describe :parse do
    it "parses text frames" do
      @web_socket.should_receive(:receive).with("Hello")
      parse [0x00, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0xff]
    end
    
    it "parses multibyte text frames" do
      @web_socket.should_receive(:receive).with(encode "Apple = ")
      parse [0x00, 0x41, 0x70, 0x70, 0x6c, 0x65, 0x20, 0x3d, 0x20, 0xef, 0xa3, 0xbf, 0xff]
    end
  end
  
  describe :frame do
    it "returns the given string formatted as a WebSocket frame" do
      bytes(@parser.frame "Hello").should == [0x00, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0xff]
    end
    
    it "encodes multibyte characters correctly" do
      message = encode "Apple = "
      bytes(@parser.frame message).should == [0x00, 0x41, 0x70, 0x70, 0x6c, 0x65, 0x20, 0x3d, 0x20, 0xef, 0xa3, 0xbf, 0xff]
    end
  end
end
