module Faye
  class Connection
    include EventMachine::Deferrable
    include Publisher
    include Timeouts
    
    MAX_DELAY = 0.001
    INTERVAL  = 0.0
    TIMEOUT   = 60.0
    
    attr_reader :id, :interval, :timeout
    
    def initialize(id, options = {})
      @id        = id
      @options   = options
      @interval  = @options[:interval] || INTERVAL
      @timeout   = @options[:timeout] || TIMEOUT
      @inbox     = Set.new
      @connected = false
      
      begin_deletion_timeout
    end
    
    def socket=(socket)
      @connected = true
      @socket    = socket
    end
    
    def deliver(message)
      return unless @inbox.add?(message)
      @socket.send(JSON.unparse(message)) if @socket
      begin_delivery_timeout
    end
    
    def connect(options, &block)
      options = options || {}
      timeout = options['timeout'] ? options['timeout'] / 1000.0 : @timeout
      
      set_deferred_status(:deferred)
      
      callback(&block)
      return if @connected
      
      @connected = true
      remove_timeout(:deletion)
      
      begin_delivery_timeout
      begin_connection_timeout(timeout)
    end
    
    def flush!
      return unless @connected
      release_connection!
      
      events = @inbox.entries
      @inbox = Set.new
      
      set_deferred_status(:succeeded, events)
      set_deferred_status(:deferred)
    end
    
  private
    
    def release_connection!
      return if @socket
      
      remove_timeout(:connection)
      remove_timeout(:delivery)
      @connected = false
      
      begin_deletion_timeout
    end
    
    def begin_delivery_timeout
      return unless @connected and not @inbox.empty?
      add_timeout(:delivery, MAX_DELAY) { flush! }
    end
    
    def begin_connection_timeout(timeout)
      return unless @connected
      add_timeout(:connection, timeout) { flush! }
    end
    
    def begin_deletion_timeout
      return if @connected
      add_timeout(:deletion, TIMEOUT + 10 * @timeout) do
        publish_event(:stale_connection, self)
      end
    end
    
  end
end

