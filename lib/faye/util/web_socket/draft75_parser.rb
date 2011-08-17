module Faye
  class WebSocket
    
    class Draft75Parser
      def self.handshake(request)
        upgrade =  "HTTP/1.1 101 Web Socket Protocol Handshake\r\n"
        upgrade << "Upgrade: WebSocket\r\n"
        upgrade << "Connection: Upgrade\r\n"
        upgrade << "WebSocket-Origin: #{request.env['HTTP_ORIGIN']}\r\n"
        upgrade << "WebSocket-Location: #{request.websocket_url}\r\n\r\n"
        upgrade
      end
      
      def initialize(web_socket)
        @socket    = web_socket
        @buffer    = []
        @buffering = false
      end
      
      def version
        'draft-75'
      end
      
      def parse(data)
        data.each_char(&method(:handle_char))
      end
      
      def frame(data, type = nil, error_type = nil)
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

