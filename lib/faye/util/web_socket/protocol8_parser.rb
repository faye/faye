require 'base64'
require 'digest/sha1'

module Faye
  class WebSocket
    
    class Protocol8Parser
      GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
      
      FIN = MASK = 0b10000000
      RSV1       = 0b01000000
      RSV2       = 0b00100000
      RSV3       = 0b00010000
      OPCODE     = 0b00001111
      LENGTH     = 0b01111111
      
      OPCODES = {
        :continuation => 0,
        :text         => 1,
        :binary       => 2,
        :close        => 8,
        :ping         => 9,
        :pong         => 10
      }
      
      ERRORS = {
        :normal_closure => 1000,
        :going_away     => 1001,
        :protocol_error => 1002,
        :unacceptable   => 1003,
        :too_large      => 1004,
        :encoding_error => 1007
      }
      
      def self.create_handshake(uri)
        hostname = uri.host + (uri.port ? ":#{uri.port}" : '')
        key      = 'ikjDfTXzAgpTF32w36Wacg=='
        
        handshake  = "GET #{uri.path} HTTP/1.1\r\n"
        handshake << "Host: #{hostname}\r\n"
        handshake << "Accept: text/html\r\n"
        handshake << "Connection: keep-alive, Upgrade\r\n"
        handshake << "Sec-WebSocket-Version: 7\r\n"
        handshake << "Sec-WebSocket-Origin: http://#{hostname}\r\n"
        handshake << "Sec-WebSocket-Key: #{key}\r\n"
        handshake << "Upgrade: websocket\r\n\r\n"
        
        handshake
      end
      
      def self.handshake(request)
        sec_key = request.env['HTTP_SEC_WEBSOCKET_KEY']
        return '' unless String === sec_key
        
        accept = Base64.encode64(Digest::SHA1.digest(sec_key + GUID)).strip
        
        upgrade =  "HTTP/1.1 101 Switching Protocols\r\n"
        upgrade << "Upgrade: websocket\r\n"
        upgrade << "Connection: Upgrade\r\n"
        upgrade << "Sec-WebSocket-Accept: #{accept}\r\n\r\n"
        upgrade
      end

      def initialize(web_socket)
        reset
        @socket = web_socket
      end
      
      def version
        'protocol-8'
      end
      
      def parse(data)
        limit  = data.respond_to?(:bytes) ? data.bytes.count : data.size
        
        byte0  = getbyte(data, 0)
        byte1  = getbyte(data, 1)
        
        return close(:protocol_error) unless byte0 and byte1
        
        final  = (byte0 & FIN) == FIN
        opcode = (byte0 & OPCODE)
        
        return close(:protocol_error) unless OPCODES.values.include?(opcode)
        reset unless opcode == OPCODES[:continuation]

        masked = (byte1 & MASK) == MASK
        length = (byte1 & LENGTH)
        offset = 0
        
        case length
          when 126 then
            length = integer(data, 2, 2)
            offset = 2
          when 127 then
            length = integer(data, 2, 8)
            offset = 8
        end
        
        if masked
          payload_offset = 2 + offset + 4 
          mask_octets    = (0..3).map { |i| getbyte(data, 2 + offset + i) }
        else
          payload_offset = 2 + offset
          mask_octets    = []
        end
        
        return close(:protocol_error) unless payload_offset + length == limit
        
        raw_payload = data[payload_offset...(payload_offset + length)]
        payload     = unmask(raw_payload, mask_octets)

        case opcode
          when OPCODES[:continuation] then
            return unless @mode == :text
            @buffer << payload
            if final
              message = @buffer * ''
              reset
              @socket.receive(Faye.encode(message))
            end

          when OPCODES[:text] then
            if final
              @socket.receive(Faye.encode(payload))
            else
              @mode = :text
              @buffer << payload
            end

          when OPCODES[:binary] then
            close(:unacceptable)

          when OPCODES[:close] then
            close(:normal_closure)

          when OPCODES[:ping] then
            @socket.send(payload, :pong)
        end
      end
      
      def frame(data, type = nil, error_type = nil)
        return nil if @closed
        
        if error_type
          data = [ERRORS[error_type]].pack('n') + data
        end
        
        opcode = OPCODES[type || :text]
        frame  = (FIN | opcode).chr
        length = data.respond_to?(:bytes) ? data.bytes.count : data.size
        
        case length
          when 0..125 then
            frame << length.chr
          when 126..65535 then
            frame << 126.chr
            frame << [length].pack('n')
          else
            frame << 127.chr
            frame << [length >> 32, length & 0xFFFFFFFF].pack('NN')
        end
        
        Faye.encode(frame) + Faye.encode(data)
      end
      
    private
      
      def reset
        @buffer = []
        @mode   = nil
      end
      
      def close(error_type)
        return if @closed
        @socket.send('', :close, error_type)
        @closed = true
      end

      def getbyte(data, offset)
        data.respond_to?(:getbyte) ? data.getbyte(offset) : data[offset]
      end
      
      def integer(data, offset, length)
        number = 0
        (0...length).each do |i|
          number += getbyte(data, offset + i) << (8 * (length - 1 - i))
        end
        number
      end
      
      def unmask(payload, mask_octets)
        return payload unless mask_octets.size > 0
        unmasked = ''
        (0...payload.size).each do |i|
          unmasked << (getbyte(payload, i) ^ mask_octets[i % 4]).chr
        end
        unmasked
      end
    end
    
  end
end

