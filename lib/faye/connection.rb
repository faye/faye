require 'set'

module Faye
  class Connection
    attr_reader :id
    
    def initialize(id)
      @id       = id
      @channels = Set.new
      @inbox    = []
    end
    
    def update(event)
      @inbox << event
    end
    
    def subscribe(channel)
      channel.add_observer(self) if @channels.add?(channel)
    end
    
    def unsubscribe(channel = nil)
      return @channels.each(&method(:unsubscribe)) if channel.nil?
      return unless @channels.member?(channel)
      @channels.delete(channel)
      channel.delete_observer(self)
    end
    
    def disconnect!
      unsubscribe
      @disconnect = true
    end
    
    def poll_events
      loop do
        break if not @inbox.empty? or
                     @disconnect
      end
      
      if @disconnect
        @disconnect = false
        return []
      end
    end
  end
end

