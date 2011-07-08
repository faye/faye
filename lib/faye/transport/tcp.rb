module Faye
  
  class Transport::Tcp < Transport
    def self.usable?(endpoint)
      endpoint.is_a?(Hash)
    end
    
    def initialize(*args)
      super
      EventMachine.connect(@endpoint[:host], @endpoint[:port], Connection) do |conn|
        @connection = conn
        conn.parent = self
      end
    end
    
    def batching?
      false
    end
    
    def request(message, timeout)
      @connection.send(JSON.dump(message))
    end
    
    class Connection < EventMachine::Connection
      include FrameParser
      attr_accessor :parent
      
      def on_message(data)
        parent.receive(JSON.parse(data))
      end
      
      def receive_data(data)
        data.each_char(&method(:handle_char))
      end
    end
  end
  
  Transport.register 'tcp', Transport::Tcp
  
end
