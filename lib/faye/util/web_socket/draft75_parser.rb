module Faye
  class WebSocket
    
    class Draft75Parser
      def initialize(web_socket)
        @socket    = web_socket
        @buffer    = []
        @buffering = false
      end
      
      def version
        'draft-75'
      end
      
      def handshake_response
        request = @socket.request
        
        upgrade =  "HTTP/1.1 101 Web Socket Protocol Handshake\r\n"
        upgrade << "Upgrade: WebSocket\r\n"
        upgrade << "Connection: Upgrade\r\n"
        upgrade << "WebSocket-Origin: #{request.env['HTTP_ORIGIN']}\r\n"
        upgrade << "WebSocket-Location: #{@socket.url}\r\n"
        upgrade << "\r\n"
        upgrade
      end
      
      def parse(data)
        data.each_byte(&method(:handle_byte))
      end
      
      def frame(data, type = nil, error_type = nil)
        ["\x00", data, "\xFF"].map(&Faye.method(:encode)) * ''
      end
      
    private
      
      def handle_byte(data)
        case data
          when 0x00 then
            @buffering = true
            
          when 0xFF then
            @socket.receive(Faye.encode(@buffer.join('')))
            @buffer = []
            @buffering = false
            
          else
            @buffer.push(data.chr) if @buffering
        end
      end
    end
    
  end
end

