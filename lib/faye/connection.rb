module Faye
  class Connection
    include EventMachine::Deferrable
    attr_reader :id   
    
    def initialize(id)
      @id       = id
      @channels = Set.new
      @inbox    = Set.new
    end
    
    # TODO queue up events so we make fewer requests
    def update(event)
      @inbox.add(event)
      flush!
    end
    
    def flush!
      events = @inbox.entries
      @inbox = Set.new
      set_deferred_status(:succeeded, events)
      set_deferred_status(:deferred)
      events
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
      @disconnect = true
    end
    
    alias :poll_events :callback
  end
end

