module Faye
  class Connection
    include EventMachine::Deferrable
    attr_reader :id   
    
    MAX_DELAY = 0.1
    
    def initialize(id)
      @id       = id
      @channels = Set.new
      @inbox    = Set.new
    end
    
    def update(event)
      @inbox.add(event)
      begin_timeout! if @connected
    end
    
    def flush!
      return unless @connected
      
      events = @inbox.entries
      @inbox = Set.new
      
      set_deferred_status(:succeeded, events)
      set_deferred_status(:deferred)
      
      @connected = false
      events
    end
    
    def connect(&block)
      callback(&block)
      @connected = true
      begin_timeout! unless @inbox.empty?
    end
    
    def begin_timeout!
      return unless @connected and
                    not @inbox.empty? and
                    @timeout.nil?
      
      @timeout = EventMachine.add_timer(MAX_DELAY) do
        @timeout = nil
        flush!
      end
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
      @disconnect = true
    end
  end
end

