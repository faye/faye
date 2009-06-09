module Faye
  class Subscription
    attr_reader :channel
    
    def initialize(channel)
      @channel = channel
      @clients = []
      @inbox   = []
    end
    
    def add_recipient(client)
      @clients << client
    end
    
    def <<(event)
      @inbox << event
    end
  end
end

