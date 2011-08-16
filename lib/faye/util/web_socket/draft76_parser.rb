require 'digest/md5'

module Faye
  class WebSocket
    
    class Draft76Parser < Draft75Parser
      class << self
        def handshake(request)
          key1   = request.env['HTTP_SEC_WEBSOCKET_KEY1']
          value1 = number_from_key(key1) / spaces_in_key(key1)
          
          key2   = request.env['HTTP_SEC_WEBSOCKET_KEY2']
          value2 = number_from_key(key2) / spaces_in_key(key2)
          
          hash = Digest::MD5.digest(big_endian(value1) +
                                    big_endian(value2) +
                                    request.body.read)
          
          upgrade =  "HTTP/1.1 101 Web Socket Protocol Handshake\r\n"
          upgrade << "Upgrade: WebSocket\r\n"
          upgrade << "Connection: Upgrade\r\n"
          upgrade << "Sec-WebSocket-Origin: #{request.env['HTTP_ORIGIN']}\r\n"
          upgrade << "Sec-WebSocket-Location: #{request.websocket_url}\r\n\r\n"
          upgrade << hash
          upgrade
        end
        
      private
        
        def number_from_key(key)
          key.scan(/[0-9]/).join('').to_i(10)
        end
        
        def spaces_in_key(key)
          key.scan(/ /).size
        end
        
        def big_endian(number)
          string = ''
          [24,16,8,0].each do |offset|
            string << (number >> offset & 0xFF).chr
          end
          string
        end
      end
      
      def version
        '76'
      end
    end
    
  end
end

