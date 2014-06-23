module Faye

  class Transport::Http < Transport
    def self.usable?(dispatcher, endpoint, &callback)
      callback.call(URI === endpoint)
    end

    def encode(messages)
      Faye.to_json(messages)
    end

    def request(messages)
      content = encode(messages)
      params  = build_params(@endpoint, content)
      request = create_request(params)

      request.callback do
        handle_response(messages, request.response)
        store_cookies(request.response_header['SET_COOKIE'])
      end

      request.errback do
        handle_error(messages)
      end

      request
    end

  private

    def build_params(uri, content)
      {
        :head => {
          'Content-Length' => content.bytesize,
          'Content-Type'   => 'application/json',
          'Cookie'         => get_cookies,
          'Host'           => uri.host
        }.merge(@dispatcher.headers),

        :body    => content,
        :timeout => -1  # for em-http-request < 1.0
      }
    end

    def create_request(params)
      version = EventMachine::HttpRequest::VERSION.split('.')[0].to_i
      client  = if version >= 1
                  options = {:inactivity_timeout => 0}
                  EventMachine::HttpRequest.new(@endpoint.to_s, options)
                else
                  EventMachine::HttpRequest.new(@endpoint.to_s)
                end

      client.post(params)
    end

    def handle_response(messages, response)
      replies = MultiJson.load(response) rescue nil
      if replies
        receive(replies)
      else
        handle_error(messages)
      end
    end
  end

  Transport.register 'long-polling', Transport::Http

end
