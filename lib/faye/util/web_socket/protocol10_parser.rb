module Faye
  class WebSocket
    
    class Protocol10Parser
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

      def initialize(web_socket)
        reset
        @socket = web_socket
      end
      
      def version
        '10'
      end
      
      def parse(data)
        byte0  = getbyte(data, 0)
        final  = (byte0 & FIN) == FIN
        opcode = (byte0 & OPCODE)
        
        return @socket.send('', :close) unless OPCODES.values.include?(opcode)
        reset unless opcode == OPCODES[:continuation]

        byte1  = getbyte(data, 1)
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
          mask_key       = data[(2+offset)...payload_offset]
          mask_octets    = (0..3).map { |i| getbyte(mask_key, i) }
        else
          payload_offset = 2 + offset
          mask_octets    = []
        end
        
        if getbyte(data, payload_offset + length)
          return @socket.send('', :close)
        end
        
        raw_payload = data[payload_offset...(payload_offset + length)]
        payload     = unmask(raw_payload, mask_octets)

        case opcode
          when OPCODES[:continuation] then
            return unless @mode == :text
            @buffer << payload
            if final
              message = @buffer * ''
              reset
              @socket.receive(message)
            end

          when OPCODES[:text] then
            if final
              @socket.receive(payload)
            else
              @mode = :text
              @buffer << payload
            end

          when OPCODES[:ping] then
            @socket.send(payload, :pong)
        end
      end
      
      def frame(data, type = nil)
        opcode = OPCODES[type || :text]
        frame  = (FIN | opcode).chr
        length = data.size
        
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
        frame << data
        frame
      end
      
    private
      
      def reset
        @buffer = []
        @mode   = nil
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
          unmasked[i] = (getbyte(payload, i) ^ mask_octets[i % 4]).chr
        end
        unmasked
      end
    end
    
  end
end

