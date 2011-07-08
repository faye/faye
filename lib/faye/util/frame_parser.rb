module Faye
  module FrameParser
    
    def initialize(*args)
      super
      @buffer = []
      @buffering = false
    end
    
    def receive_data(data)
      data.each_char(&method(:handle_char))
    end
    
    def handle_char(data)
      case data
        when "\x00" then
          @buffering = true
          
        when "\xFF" then
          message = encode(@buffer.join(''))
          
          @buffer = []
          @buffering = false
          
          on_message(message)
          
        else
          @buffer.push(data) if @buffering
        end
    end
    
    def send(data)
      string = ["\x00", data, "\xFF"].map(&method(:encode)) * ''
      send_data(string)
    end
    
    def encode(string, encoding = 'UTF-8')
      return string unless string.respond_to?(:force_encoding)
      string.force_encoding(encoding)
    end
    
  end
end
