module Faye
  class Adapter::Tcp
    
    include Adapter::Common
    DEFAULT_HOST = 'localhost'
    
    def initialize(options)
      @server = Server.new(options)
    end
    
    def listen(port, host = DEFAULT_HOST)
      EventMachine.run do
        EventMachine.start_server(host, port, Connection, &method(:setup_connection))
      end
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
