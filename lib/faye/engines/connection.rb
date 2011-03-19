module Faye
  module Engine
    
    class Connection
      include EventMachine::Deferrable
      include Timeouts
      
      attr_reader :id, :interval, :timeout
      
      def initialize(engine, id, options = {})
        @engine  = engine
        @id      = id
        @options = options
        @inbox   = Set.new
      end
      
      def deliver(message)
        return unless @inbox.add?(message)
        begin_delivery_timeout
      end
      
      def connect(options, &block)
        options = options || {}
        timeout = options['timeout'] ? options['timeout'] / 1000.0 : @engine.timeout
        
        set_deferred_status(:deferred)
        
        callback(&block)
        return if @connected
        
        @connected = true
        
        begin_delivery_timeout
        begin_connection_timeout(timeout)
      end
      
      def flush!
        release_connection!
        set_deferred_status(:succeeded, @inbox.entries)
      end
      
    private
      
      def release_connection!
        @engine.close_connection(@id)
        remove_timeout(:connection)
        remove_timeout(:delivery)
        @connected = false
      end
      
      def begin_delivery_timeout
        return if @inbox.empty?
        add_timeout(:delivery, MAX_DELAY) { flush! }
      end
      
      def begin_connection_timeout(timeout)
        add_timeout(:connection, timeout) { flush! }
      end
    end
    
  end
end

