require 'set'

module Faye
  class Connection
    attr_reader :id
    
    def initialize(id)
      @id       = id
      @channels = Set.new
      @inbox    = Set.new
    end
    
    def update(event)
      @inbox.add(event)
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
      loop { break if @disconnect or not @inbox.empty? }
      
      @disconnect = false
      
      events = @inbox.entries
      @inbox = Set.new
      events
    end
  end
end

