module Faye
  class Connection
    include EventMachine::Deferrable
    include Observable
    
    extend  Forwardable
    def_delegators :EventMachine, :add_timer, :cancel_timer
    
    MAX_DELAY = 0.1
    INTERVAL  = 1.0
    TIMEOUT   = 60.0
    
    attr_reader :id   
    
    def initialize(id)
      @id       = id
      @channels = Set.new
      @inbox    = Set.new
    end
    
    def update(event)
      @inbox.add(event)
      begin_delivery_timeout! if @connected
    end
    
    def flush!
      return unless @connected
      release_connection!
      
      events = @inbox.entries
      @inbox = Set.new
      
      set_deferred_status(:succeeded, events)
      set_deferred_status(:deferred)
    end
    
    def connect(&block)
      callback(&block)
      
      @mark_for_deletion  = false
      @connected          = true
      
      begin_delivery_timeout! unless @inbox.empty?
      begin_connection_timeout!
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
    
    def disconnect!
      unsubscribe(:all)
      flush!
    end
    
  private
    
    def begin_delivery_timeout!
      return unless @connected and not @inbox.empty? and @delivery_timeout.nil?
      @delivery_timeout = add_timer(MAX_DELAY) { flush! }
    end
    
    def begin_connection_timeout!
      return unless @connected and @connection_timeout.nil?
      @connection_timeout = add_timer(TIMEOUT) { flush! }
    end
    
    def release_connection!
      if @connection_timeout
        cancel_timer(@connection_timeout)
        @connection_timeout = nil
      end
      
      if @delivery_timeout
        cancel_timer(@delivery_timeout)
        @delivery_timeout = nil
      end
      
      @connected = false
      schedule_for_deletion!
    end
    
    def schedule_for_deletion!
      return if @mark_for_deletion
      @mark_for_deletion = true
      
      add_timer(10 * INTERVAL) do
        if @mark_for_deletion
          changed(true)
          notify_observers(:stale_client, self)
        end
      end
    end
    
  end
end

