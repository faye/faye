require 'thin'

module Faye
  class WebSocket
    
    class Client
      include API
      
      def initialize(url)
        @parser = Protocol8Parser
        @url    = url
        @uri    = URI.parse(url)
        
        @ready_state = CONNECTING
        
        EventMachine.connect(@uri.host, @uri.port || 80, Connection) do |conn|
          @stream = conn
          conn.parent = self
        end
      end
      
      def on_connect
        @stream.write(@parser.create_handshake(@uri))
      end
      
      def receive_data(data)
        case @ready_state
          when CONNECTING then
            # TODO validate response
            
            @ready_state = OPEN
            @parser = @parser.new(self)
            event = Event.new
            event.init_event('open', false, false)
            dispatch_event(event)
            
          when OPEN
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
