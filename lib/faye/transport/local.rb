module Faye

  class Transport::Local < Transport
    def self.usable?(client, endpoint, &callback)
      callback.call(Server === endpoint)
    end

    def batching?
      false
    end

    def request(messages, timeout)
      messages = Faye.copy_object(messages)
      @endpoint.process(messages, true) do |responses|
        receive(Faye.copy_object(responses))
      end
    end
  end

  Transport.register 'in-process', Transport::Local

end
