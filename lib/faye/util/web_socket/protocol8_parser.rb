require 'base64'
require 'digest/sha1'
require 'net/http'

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
      
      FRAGMENTED_OPCODES = OPCODES.values_at(:continuation, :text, :binary)
      OPENING_OPCODES = OPCODES.values_at(:text, :binary)
      
      ERRORS = {
        :normal_closure   => 1000,
        :going_away       => 1001,
        :protocol_error   => 1002,
        :unacceptable     => 1003,
        :encoding_error   => 1007,
        :policy_violation => 1008,
        :too_large        => 1009,
        :extension_error  => 1010
      }
      
      ERROR_CODES = ERRORS.values
      
      class Handshake
        def initialize(uri)
          @uri    = uri
          @key    = Base64.encode64((1..16).map { rand(255).chr } * '').strip
          @accept = Base64.encode64(Digest::SHA1.digest(@key + GUID)).strip
          @buffer = []
        end
        
        def request_data
          hostname = @uri.host + (@uri.port ? ":#{@uri.port}" : '')
          
          handshake  = "GET #{@uri.path} HTTP/1.1\r\n"
          handshake << "Host: #{hostname}\r\n"
          handshake << "Upgrade: websocket\r\n"
          handshake << "Connection: Upgrade\r\n"
          handshake << "Sec-WebSocket-Key: #{@key}\r\n"
          handshake << "Sec-WebSocket-Version: 8\r\n"
          handshake << "\r\n"
          
          handshake
        end
        
        def parse(data)
          @buffer += data.bytes.to_a
        end
        
        def complete?
          @buffer[-4..-1] == [0x0D, 0x0A, 0x0D, 0x0A]
        end
        
        def valid?
          data = Faye.encode(@buffer)
          response = Net::HTTPResponse.read_new(Net::BufferedIO.new(StringIO.new(data)))
          return false unless response.code.to_i == 101
          
          upgrade, connection = response['Upgrade'], response['Connection']
          
          upgrade and upgrade =~ /^websocket$/i and
          connection and connection.split(/\s*,\s*/).include?('Upgrade') and
          response['Sec-WebSocket-Accept'] == @accept
        end
      end
      
      def initialize(web_socket)
        reset
        @socket = web_socket
        @stage  = 0
      end
      
      def version
        'protocol-8'
      end
      
      def handshake_response
        sec_key = @socket.request.env['HTTP_SEC_WEBSOCKET_KEY']
        return '' unless String === sec_key
        
        accept = Base64.encode64(Digest::SHA1.digest(sec_key + GUID)).strip
        
        upgrade =  "HTTP/1.1 101 Switching Protocols\r\n"
        upgrade << "Upgrade: websocket\r\n"
        upgrade << "Connection: Upgrade\r\n"
        upgrade << "Sec-WebSocket-Accept: #{accept}\r\n"
        upgrade << "\r\n"
        upgrade
      end
      
      def create_handshake
        Handshake.new(@socket.uri)
      end
      
      def parse(data)
        data.each_byte do |byte|
          case @stage
          when 0 then parse_opcode(byte)
          when 1 then parse_length(byte)
          when 2 then parse_extended_length(byte)
          when 3 then parse_mask(byte)
          when 4 then parse_payload(byte)
          end
          emit_frame if @stage == 4 and @length == 0
        end
      end
      
      def frame(data, type = nil, error_type = nil)
        return nil if @closed
        
        if error_type
          data = [ERRORS[error_type]].pack('n') + data
        end
        
        opcode = OPCODES[type || (String === data ? :text : :binary)]
        frame  = (FIN | opcode).chr
        length = data.respond_to?(:bytes) ? data.bytes.count : data.size
        
        case length
          when 0..125 then
            frame << length
          when 126..65535 then
            frame << 126
            frame << [length].pack('n')
          else
            frame << 127
            frame << [length >> 32, length & 0xFFFFFFFF].pack('NN')
        end
        
        Faye.encode(frame) + Faye.encode(data)
      end
      
      def close(error_type = nil, &callback)
        return if @closed
        @closing_callback ||= callback
        @socket.send('', :close, error_type || :normal_closure)
        @closed = true
      end
      
    private
      
      def parse_opcode(data)
        if [RSV1, RSV2, RSV3].any? { |rsv| (data & rsv) == rsv }
          return @socket.close(:protocol_error)
        end
        
        @final   = (data & FIN) == FIN
        @opcode  = (data & OPCODE)
        @mask    = []
        @payload = []
        
        unless OPCODES.values.include?(@opcode)
          return @socket.close(:protocol_error)
        end
        
        unless FRAGMENTED_OPCODES.include?(@opcode) or @final
          return @socket.close(:protocol_error)
        end
        
        if @mode and OPENING_OPCODES.include?(@opcode)
          return @socket.close(:protocol_error)
        end
        
        @stage = 1
      end
      
      def parse_length(data)
        @masked = (data & MASK) == MASK
        @length = (data & LENGTH)
        
        if @length <= 125
          @stage = @masked ? 3 : 4
        else
          @length_buffer = []
          @length_size   = (@length == 126) ? 2 : 8
          @stage         = 2
        end
      end
      
      def parse_extended_length(data)
        @length_buffer << data
        return unless @length_buffer.size == @length_size
        @length = integer(@length_buffer)
        @stage  = @masked ? 3 : 4
      end
      
      def parse_mask(data)
        @mask << data
        return if @mask.size < 4
        @stage = 4
      end
      
      def parse_payload(data)
        @payload << data
        return if @payload.size < @length
        emit_frame
      end
      
      def emit_frame
        payload = unmask(@payload, @mask)
        
        case @opcode
          when OPCODES[:continuation] then
            return @socket.close(:protocol_error) unless @mode
            @buffer += payload
            if @final
              message = @buffer
              message = Faye.encode(message, true) if @mode == :text
              reset
              if message
                @socket.receive(message)
              else
                @socket.close(:encoding_error)
              end
            end

          when OPCODES[:text] then
            if @final
              message = Faye.encode(payload, true)
              if message
                @socket.receive(message)
              else
                @socket.close(:encoding_error)
              end
            else
              @mode = :text
              @buffer += payload
            end

          when OPCODES[:binary] then
            if @final
              @socket.receive(payload)
            else
              @mode = :binary
              @buffer += payload
            end

          when OPCODES[:close] then
            error_code = (payload.size >= 2) ? 256 * payload[0] + payload[1] : 0
            
            error_type = (payload.size == 0) ||
                         (error_code >= 3000 && error_code < 5000) ||
                         ERROR_CODES.include?(error_code) ?
                         :normal_closure :
                         :protocol_error
            
            error_type = :protocol_error if payload.size > 125 or
                                            not Faye.valid_utf8?(payload[2..-1] || [])
            
            @socket.close(error_type)
            @closing_callback.call if @closing_callback

          when OPCODES[:ping] then
            return @socket.close(:protocol_error) if payload.size > 125
            @socket.send(payload, :pong)
        end
        @stage = 0
      end

      def reset
        @buffer = []
        @mode   = nil
      end
      
      def getbyte(data, offset)
        data.respond_to?(:getbyte) ? data.getbyte(offset) : data[offset]
      end
      
      def integer(bytes)
        number = 0
        bytes.each_with_index do |data, i|
          number += data << (8 * (bytes.size - 1 - i))
        end
        number
      end
      
      def unmask(payload, mask)
        unmasked = []
        payload.each_with_index do |byte, i|
          byte = byte ^ mask[i % 4] if mask.size > 0
          unmasked << byte
        end
        unmasked
      end
    end
    
  end
end

