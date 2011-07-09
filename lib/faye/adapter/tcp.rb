module Faye
  class Adapter::Tcp
    
    include Adapter::Common
    DEFAULT_HOST = 'localhost'
    
    CONNECTION_TYPES = %w[tcp in-process]

    def initialize(options)
      @server = Server.new(CONNECTION_TYPES, options)
    end
    
    def listen(port, host = DEFAULT_HOST)
      if EventMachine.reactor_running?
        start(port, host)
      else
        EventMachine.run { start(port, host) }
      end
    end
    
    def start(port, host = DEFAULT_HOST)
      EventMachine.start_server(host, port, Connection, &method(:setup_connection))
    end
    
    def setup_connection(connection)
      connection.server = @server
    end
    
    class Connection < EventMachine::Connection
      include FrameParser
      attr_accessor :server
      
      def on_message(data)
        message = JSON.parse(data)
        server.process(message, false) do |replies|
          send(JSON.dump(replies))
        end
      end
    end
    
  end
end
