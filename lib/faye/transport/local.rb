module Faye

  class Transport::Local < Transport
    def self.usable?(client, endpoint, &callback)
      callback.call(endpoint.is_a?(Server))
    end

    def batching?
      false
    end

    def request(message, timeout)
      message = Faye.copy_object(message)
      @endpoint.process(message, true) do |responses|
        receive(Faye.copy_object(responses))
      end
    end
  end

  Transport.register 'in-process', Transport::Local

end
