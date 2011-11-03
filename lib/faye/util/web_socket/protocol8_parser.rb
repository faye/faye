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
      
      ERRORS = {
        :normal_closure => 1000,
        :going_away     => 1001,
        :protocol_error => 1002,
        :unacceptable   => 1003,
        :too_large      => 1004,
        :encoding_error => 1007
      }
      
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
          data.each_byte { |b| @buffer << b.chr }
        end
        
        def complete?
          @buffer[-4..-1] == ["\r", "\n", "\r", "\n"]
        end
        
        def valid?
          data = Faye.encode(@buffer * '')
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
        
        opcode = OPCODES[type || :text]
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
        @final   = (data & FIN) == FIN
        @opcode  = (data & OPCODE)
        @mask    = []
        @payload = []
        
        return @socket.close(:protocol_error) unless OPCODES.values.include?(@opcode)
        @stage   = 1
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
            return unless @mode == :text
            @buffer << payload
            if @final
              message = @buffer * ''
              reset
              @socket.receive(Faye.encode(message))
            end

          when OPCODES[:text] then
            if @final
              @socket.receive(Faye.encode(payload))
            else
              @mode = :text
              @buffer << payload
            end

          when OPCODES[:binary] then
            @socket.close(:unacceptable)

          when OPCODES[:close] then
            @socket.close(:normal_closure)
            @closing_callback.call if @closing_callback

          when OPCODES[:ping] then
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
        unmasked = ''
        payload.each_with_index do |byte, i|
          byte = byte ^ mask[i % 4] if mask.size > 0
          unmasked << byte
        end
        unmasked
      end
    end
    
  end
end

