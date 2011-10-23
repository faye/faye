module Faye
  class Session
    attr_reader :client_id
    
    def initialize(engine, client_id)
      @engine    = engine
      @client_id = client_id
    end
    
    def deliver(channel, data)
      @engine.deliver(@client_id, {'channel' => channel, 'data' => data})
    end
  end
end

