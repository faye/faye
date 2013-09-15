module Faye

  class Transport::Local < Transport
    def self.usable?(client, endpoint, &callback)
      callback.call(Server === endpoint)
    end

    def batching?
      false
    end

    def request(envelopes)
      messages = Faye.copy_object(envelopes.map { |e| e.message })
      @endpoint.process(messages, nil) do |responses|
        receive(envelopes, Faye.copy_object(responses))
      end
    end
  end

  Transport.register 'in-process', Transport::Local

end
