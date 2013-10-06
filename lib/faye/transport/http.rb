module Faye

  class Transport::Http < Transport
    def self.usable?(client, endpoint, &callback)
      callback.call(URI === endpoint)
    end

    def encode(envelopes)
      Faye.to_json(envelopes.map { |e| e.message })
    end

    def request(envelopes)
      content = encode(envelopes)
      params  = build_params(@endpoint, content)
      request = create_request(params)

      request.callback do
        handle_response(request.response, envelopes)
        store_cookies(request.response_header['SET_COOKIE'])
      end

      request.errback do
        handle_error(envelopes)
      end
    end

  private

    def build_params(uri, content)
      {
        :head => {
          'Content-Length'  => content.bytesize,
          'Content-Type'    => 'application/json',
          'Cookie'          => get_cookies,
          'Host'            => uri.host
        }.merge(@client.headers),

        :body    => content,
        :timeout => -1  # for em-http-request < 1.0
      }
    end

    def create_request(params)
      version = EventMachine::HttpRequest::VERSION.split('.')[0].to_i
      client  = if version >= 1
                  options = {                 # for em-http-request >= 1.0
                    :inactivity_timeout => 0  # connection inactivity (post-setup) timeout (0 = disable timeout)
                  }
                  EventMachine::HttpRequest.new(@endpoint.to_s, options)
                else
                  EventMachine::HttpRequest.new(@endpoint.to_s)
                end

      client.post(params)
    end

    def handle_response(response, envelopes)
      message = MultiJson.load(response) rescue nil
      if message
        receive(envelopes, message)
      else
        handle_error(envelopes)
      end
    end
  end

  Transport.register 'long-polling', Transport::Http

end
