module Faye

  class Transport::Http < Transport
    def self.usable?(client, endpoint, &callback)
      callback.call(URI === endpoint)
    end

    def request(message, timeout)
      retry_block = retry_block(message, timeout)

      content = Faye.to_json(message)
      cookies = @cookies.get_cookies(@endpoint.to_s)
      params  = build_params(@endpoint, content, cookies)
      request = create_request(params)

      request.callback do
        handle_response(request.response, retry_block)
        store_cookies([*request.response_header['SET_COOKIE']].compact)
      end
      request.errback do
        retry_block.call
        trigger(:down)
      end
    end

  private

    def build_params(uri, content, cookies)
      {
        :head => {
          'Content-Length'  => content.bytesize,
          'Content-Type'    => 'application/json',
          'Cookie'          => cookies * '; ',
          'Host'            => uri.host
        }.merge(@headers),

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

    def handle_response(response, retry_block)
      message = MultiJson.load(response) rescue nil
      if message
        receive(message)
        trigger(:up)
      else
        retry_block.call
        trigger(:down)
      end
    end

    def store_cookies(cookies)
      cookies.each do |cookie|
        @cookies.set_cookie(@endpoint, cookie)
      end
    end
  end

  Transport.register 'long-polling', Transport::Http

end
