module Faye
  class WebSocket
    
    class Protocol76Parser
      def initialize(web_socket)
        @socket    = web_socket
        @buffer    = []
        @buffering = false
      end
      
      def version
        '76'
      end
      
      def parse(data)
        data.each_char(&method(:handle_char))
      end
      
      def frame(data, type = nil)
        "\x00#{ data }\xFF"
      end
      
    private
      
      def handle_char(data)
        case data
          when "\x00" then
            @buffering = true
            
          when "\xFF" then
            @socket.receive(@buffer.join(''))
            @buffer = []
            @buffering = false
            
          else
            @buffer.push(data) if @buffering
        end
      end
    end
    
  end
end

