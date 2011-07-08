module Faye
  
  class Transport::Tcp < Transport
    include EventMachine::Deferrable
    
    UNCONNECTED = 1
    CONNECTING  = 2
    CONNECTED   = 3
    
    def self.usable?(endpoint)
      endpoint.is_a?(Hash)
    end
    
    def initialize(*args)
      super
      connect
    end
    
    def batching?
      false
    end
    
    def request(messages, timeout = nil)
      @timeout  ||= timeout
      @messages ||= {}
      messages.each { |message| @messages[message['id']] = message }
      with_socket { |socket| socket.send(JSON.dump(messages)) }
    end
    
    def with_socket(&block)
      callback(&block)
      connect
    end
    
    def connect
      @state ||= UNCONNECTED
      return unless @state == UNCONNECTED
      
      @state = CONNECTING
      
      EventMachine.connect(@endpoint[:host], @endpoint[:port], Connection) do |conn|
        @connection = conn
        conn.parent = self
        
        @state = CONNECTED
        @timeout = nil
        set_deferred_status(:succeeded, @connection)
      end
    end
    
    def receive(messages)
      messages.each { |message| @messages.delete(message['id']) }
      super
    end
    
    def on_close
      was_connected = (@state == CONNECTED)
      set_deferred_status(:deferred)
      @state = UNCONNECTED
      @connection = nil
      
      return resend if was_connected
      
      EventMachine.add_timer(@timeout) { connect }
      @timeout = @timeout * 2
    end
    
    def resend
      messages = @messages.values
      request(messages)
    end
    
    class Connection < EventMachine::Connection
      include FrameParser
      attr_accessor :parent
      
      def on_message(data)
        parent.receive(JSON.parse(data))
      end
      
      def unbind
        parent.on_close
      end
    end
  end
  
  Transport.register 'tcp', Transport::Tcp
  
end
