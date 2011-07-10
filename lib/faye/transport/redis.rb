module Faye
  
  # This transport is a little weird. As an experiment, and in order to pinpoint
  # potential optimizations, this transport bypasses the Faye TCP server and
  # talks directly to Redis. It does this by creating a Faye::Server, which
  # knows how to mediate between the Faye protocol and the Redis engine, and it
  # then talks directly to this Server without going over the wire.
  
  class Transport::Redis < Transport
    def self.usable?(endpoint)
      endpoint.is_a?(Hash) and endpoint[:type] == 'redis'
    end
    
    def initialize(*args)
      super
      @server = Server.new(['redis'], :engine => @endpoint)
    end
    
    def batching?
      false
    end
    
    def request(message, timeout)
      @server.process(message, true) { |responses| receive(responses) }
    end
  end
  
  Transport.register 'redis', Transport::Redis
  
end
