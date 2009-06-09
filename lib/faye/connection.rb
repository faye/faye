module Faye
  class Connection
    attr_reader :id
    
    def initialize(id)
      @id    = id
      @inbox = []
    end
    
    def <<(event)
      @inbox << event
    end
  end
end

