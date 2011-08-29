module Faye
  
  class Transport::Local < Transport
    def self.usable?(endpoint, &callback)
      callback.call(endpoint.is_a?(Server))
    end
    
    def batching?
      false
    end
    
    def request(message, timeout)
      @endpoint.process(message, true) { |responses| receive(responses) }
    end
  end
  
  Transport.register 'in-process', Transport::Local
  
end
