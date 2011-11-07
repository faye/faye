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
          
          handshake  = "GET #{@uri.path}#{@uri.query ? '?' : ''}#{@uri.query} HTTP/1.1\r\n"
          handshake << "Host: #{hostname}\r\n"
          handshake << "Upgrade: websocket\r\n"
          handshake << "Connection: Upgrade\r\n"
          handshake << "Sec-WebSocket-Key: #{@key}\r\n"
          handshake << "Sec-WebSocket-Version: 8\r\n"
          handshake << "\r\n"
          
          handshake
        end
        
        def parse(data)
          message  = []
          complete = false
          data.each_byte do |byte|
            if complete
              message << byte
            else
              @buffer << byte
              complete ||= complete?
            end
          end
          message
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
      
      def initialize(web_socket, options = {})
        reset
        @socket  = web_socket
        @stage   = 0
        @masking = options[:masking]
      end
      
      def version
        'protocol-8'
      end
      
      def handshake_response
        sec_key = @socket.env['HTTP_SEC_WEBSOCKET_KEY']
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
      
      def frame(data, type = nil, code = nil)
        return nil if @closed
        
        type ||= (String === data ? :text : :binary)
        data   = data.bytes.to_a if data.respond_to?(:bytes)
        
        if code
          data = [code].pack('n').bytes.to_a + data
        end
        
        frame  = (FIN | OPCODES[type]).chr
        length = data.size
        masked = @masking ? MASK : 0
        
        case length
          when 0..125 then
            frame << (masked | length).chr
          when 126..65535 then
            frame << (masked | 126).chr
            frame << [length].pack('n')
          else
            frame << (masked | 127).chr
            frame << [length >> 32, length & 0xFFFFFFFF].pack('NN')
        end
        
        if @masking
          mask = (1..4).map { rand 256 }
          data.each_with_index do |byte, i|
            data[i] = byte ^ mask[i % 4]
          end
          frame << mask.pack('C*')
        end
        
        Faye.encode(frame) + Faye.encode(data)
      end
      
      def close(code = nil, reason = nil, &callback)
        return if @closed
        @closing_callback ||= callback
        @socket.send(reason || '', :close, code || ERRORS[:normal_closure])
        @closed = true
      end
      
    private
      
      def parse_opcode(data)
        if [RSV1, RSV2, RSV3].any? { |rsv| (data & rsv) == rsv }
          return @socket.close(ERRORS[:protocol_error], nil, false)
        end
        
        @final   = (data & FIN) == FIN
        @opcode  = (data & OPCODE)
        @mask    = []
        @payload = []
        
        unless OPCODES.values.include?(@opcode)
          return @socket.close(ERRORS[:protocol_error], nil, false)
        end
        
        unless FRAGMENTED_OPCODES.include?(@opcode) or @final
          return @socket.close(ERRORS[:protocol_error], nil, false)
        end
        
        if @mode and OPENING_OPCODES.include?(@opcode)
          return @socket.close(ERRORS[:protocol_error], nil, false)
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
            return @socket.close(ERRORS[:protocol_error], nil, false) unless @mode
            @buffer += payload
            if @final
              message = @buffer
              message = Faye.encode(message, true) if @mode == :text
              reset
              if message
                @socket.receive(message)
              else
                @socket.close(ERRORS[:encoding_error], nil, false)
              end
            end

          when OPCODES[:text] then
            if @final
              message = Faye.encode(payload, true)
              if message
                @socket.receive(message)
              else
                @socket.close(ERRORS[:encoding_error], nil, false)
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
            code = (payload.size >= 2) ? 256 * payload[0] + payload[1] : nil
            
            unless (payload.size == 0) or
                   (code && code >= 3000 && code < 5000) or
                   ERROR_CODES.include?(code)
              code = ERRORS[:protocol_error]
            end
            
            if payload.size > 125 or not Faye.valid_utf8?(payload[2..-1] || [])
              code = ERRORS[:protocol_error]
            end
            
            reason = (payload.size > 2) ? Faye.encode(payload[2..-1], true) : nil
            @socket.close(code, reason, false)
            @closing_callback.call if @closing_callback

          when OPCODES[:ping] then
            return @socket.close(ERRORS[:protocol_error], nil, false) if payload.size > 125
            @socket.send(payload, :pong)
        end
        @stage = 0
      end

      def reset
        @buffer = []
        @mode   = nil
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

