module Faye
  module Engine
    
    MAX_DELAY = 0.0
    INTERVAL  = 0.0
    TIMEOUT   = 60.0
    
    def self.register(type, klass)
      @backends ||= {}
      @backends[type] = klass
    end
    
    def self.get(options)
      options ||= {}
      klass = @backends[options[:type]] || Memory
      klass.new(options)
    end
    
    class Base
      include Timeouts
      
      attr_reader :interval, :timeout
      
      def initialize(options)
        @options     = options
        @connections = {}
        @interval    = @options[:interval] || INTERVAL
        @timeout     = @options[:timeout]  || TIMEOUT
      end
      
      def connect(client_id, options = {}, &callback)
        conn = connection(client_id, true)
        conn.connect(options, &callback)
        flush(client_id)
      end
      
      def connection(client_id, create)
        conn = @connections[client_id]
        return conn if conn or not create
        @connections[client_id] = Connection.new(self, client_id)
      end
      
      def close_connection(client_id)
        @connections.delete(client_id)
      end
    end
    
  end
end

