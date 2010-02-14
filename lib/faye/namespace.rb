module Faye
  class Namespace
    
    def initialize
      @used = {}
    end
    
    def generate
      name = Faye.random
      name = Faye.random while @used.has_key?(name)
      @used[name] = name
    end
    
  end
end

