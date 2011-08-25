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
        upgrade << "WebSocket-Location: #{websocket_url}\r\n"
        upgrade << "\r\n"
        upgrade
      end
      
      def parse(data)
        data.each_char(&method(:handle_char))
      end
      
      def frame(data, type = nil, error_type = nil)
        ["\x00", data, "\xFF"].map(&Faye.method(:encode)) * ''
      end
      
    private
      
      def secure_websocket?
        env = @socket.request.env
        if env.has_key?('HTTP_X_FORWARDED_PROTO')
          env['HTTP_X_FORWARDED_PROTO'] == 'https'
        else
          env['HTTP_ORIGIN'] =~ /^https:/i
        end
      end
      
      def websocket_url
        scheme = secure_websocket? ? 'wss:' : 'ws:'
        env = @socket.request.env
        env['websocket.url'] = "#{ scheme }//#{ env['HTTP_HOST'] }#{ env['REQUEST_URI'] }"
      end
      
      def handle_char(data)
        case data
          when "\x00" then
            @buffering = true
            
          when "\xFF" then
            @socket.receive(Faye.encode(@buffer.join('')))
            @buffer = []
            @buffering = false
            
          else
            @buffer.push(data) if @buffering
        end
      end
    end
    
  end
end

