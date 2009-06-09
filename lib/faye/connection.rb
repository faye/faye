module Faye
  class Connection
    attr_reader :id
    
    def initialize(id)
      @id = id
    end
  end
end

