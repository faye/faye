module Faye
  class WebSocket
    
    class Client
      include API
      attr_reader :uri
      
      def initialize(url)
        @parser = Protocol8Parser.new(self)
        @url    = url
        @uri    = URI.parse(url)
        
        @ready_state = CONNECTING
        
        EventMachine.connect(@uri.host, @uri.port || 80, Connection) do |conn|
          @stream = conn
          conn.parent = self
        end
      end
      
      def on_connect
        @handshake = @parser.create_handshake
        @stream.write(@handshake.request_data)
      end
      
      def receive_data(data)
        data = Faye.encode(data)
        
        case @ready_state
          when CONNECTING then
            if @handshake.valid?(data)
              @ready_state = OPEN
              event = Event.new
              event.init_event('open', false, false)
              dispatch_event(event)
            else
              @ready_state = CLOSED
              event = Event.new
              event.init_event('error', false, false)
              dispatch_event(event)
            end
            
          when OPEN then
            @parser.parse(data)
        end
      end
      
      module Connection
        attr_accessor :parent
        
        def connection_completed
          parent.on_connect
        end
        
        def receive_data(data)
          parent.receive_data(data)
        end
        
        def write(data)
          send_data(data)
        end
      end
    end
    
  end
end
