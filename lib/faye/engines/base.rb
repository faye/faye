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
      include Logging
      include ::Faye::Engine::Callbacks
      
      attr_reader :interval, :timeout
      
      def initialize(options)
        @options     = options
        @connections = {}
        @interval    = @options[:interval] || INTERVAL
        @timeout     = @options[:timeout]  || TIMEOUT

        debug 'Created new engine: ?', @options
      end
      
      def connect(client_id, options = {}, &callback)
        debug 'Accepting connection from ?', client_id
        ping(client_id)
        conn = connection(client_id, true)
        conn.connect(options, &callback)
        empty_queue(client_id)
      end
      
      def connection(client_id, create)
        conn = @connections[client_id]
        return conn if conn or not create
        @connections[client_id] = Connection.new(self, client_id)
      end
      
      def close_connection(client_id)
        debug 'Closing connection for ?', client_id
        @connections.delete(client_id)
      end
      
      def flush(client_id)
        debug 'Flushing message queue for ?', client_id
        conn = @connections[client_id]
        conn.flush! if conn
      end
    end
    
  end
end

