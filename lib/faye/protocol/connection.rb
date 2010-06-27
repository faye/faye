module Faye
  class Connection
    include EventMachine::Deferrable
    include Publisher
    include Timeouts
    
    MAX_DELAY = 0.1
    INTERVAL  = 0.0
    TIMEOUT   = 60.0
    
    attr_reader :id, :interval, :timeout
    
    def initialize(id, options = {})
      @id        = id
      @options   = options
      @interval  = @options[:interval] || INTERVAL
      @timeout   = @options[:timeout] || TIMEOUT
      @channels  = Set.new
      @inbox     = Set.new
      @connected = false
    end
    
    def socket=(socket)
      @connected = true
      @socket    = socket
    end
    
    def on_message(event)
      return unless @inbox.add?(event)
      @socket.send(JSON.unparse(event)) if @socket
      begin_delivery_timeout!
    end
    
    def subscribe(channel)
      return unless @channels.add?(channel)
      channel.add_subscriber(:message, method(:on_message))
    end
    
    def unsubscribe(channel)
      return @channels.each(&method(:unsubscribe)) if channel == :all
      return unless @channels.member?(channel)
      @channels.delete(channel)
      channel.remove_subscriber(:message, method(:on_message))
    end
    
    def connect(&block)
      set_deferred_status(:deferred)
      
      callback(&block)
      return if @connected
      
      @connected = true
      remove_timeout(:deletion)
      
      begin_delivery_timeout!
      begin_connection_timeout!
    end
    
    def flush!
      return unless @connected
      release_connection!
      
      events = @inbox.entries
      @inbox = Set.new
      
      set_deferred_status(:succeeded, events)
      set_deferred_status(:deferred)
    end
    
    def disconnect!
      unsubscribe(:all)
      flush!
    end
    
  private
    
    def begin_delivery_timeout!
      return unless @connected and not @inbox.empty?
      add_timeout(:delivery, MAX_DELAY) { flush! }
    end
    
    def begin_connection_timeout!
      return unless @connected
      add_timeout(:connection, @timeout) { flush! }
    end
    
    def release_connection!
      return if @socket
      
      remove_timeout(:connection)
      remove_timeout(:delivery)
      @connected = false
      
      add_timeout(:deletion, 10 * @timeout) do
        publish_event(:stale_connection, self)
      end
    end
    
  end
end

