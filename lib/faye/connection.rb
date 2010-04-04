module Faye
  class Connection
    include EventMachine::Deferrable
    include Observable
    include Timeouts
    
    MAX_DELAY = 0.1
    INTERVAL  = 1.0
    TIMEOUT   = 60.0
    
    attr_reader :id   
    
    def initialize(id, options = {})
      @id        = id
      @options   = options
      @channels  = Set.new
      @inbox     = Set.new
      @connected = false
    end
    
    def timeout
      @options[:timeout] || TIMEOUT
    end
    
    def update(message, event)
      return unless message == :message
      @inbox.add(event)
      begin_delivery_timeout!
    end
    
    def subscribe(channel)
      channel.add_observer(self) if @channels.add?(channel)
    end
    
    def unsubscribe(channel)
      return @channels.each(&method(:unsubscribe)) if channel == :all
      return unless @channels.member?(channel)
      @channels.delete(channel)
      channel.delete_observer(self)
    end
    
    def connect(&block)
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
      add_timeout(:connection, timeout) { flush! }
    end
    
    def release_connection!
      remove_timeout(:connection)
      remove_timeout(:delivery)
      @connected = false
      
      add_timeout(:deletion, 10 * INTERVAL) do
        changed(true)
        notify_observers(:stale_client, self)
      end
    end
    
  end
end

