module Faye
  class Connection
    attr_reader :id
    
    def initialize(id)
      @id    = id
      @inbox = []
    end
    
    def update(event)
      @inbox << event
    end
    
    def subscribe(channel)
      channel.add_observer(self)
    end
    
    def unsubscribe(channel)
      channel.delete_observer(self)
    end
  end
end

