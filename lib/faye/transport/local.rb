module Faye

  class Transport::Local < Transport
    def self.usable?(dispatcher, endpoint, &callback)
      callback.call(Server === endpoint)
    end

    def batching?
      false
    end

    def request(messages)
      @endpoint.process(messages, nil) do |replies|
        receive(Faye.copy_object(replies))
      end
    end
  end

  Transport.register 'in-process', Transport::Local

end
