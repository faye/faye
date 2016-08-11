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
      params  = build_params(content)
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

    def build_params(content)
      params = {
        :head => {
          'Content-Length' => content.bytesize,
          'Content-Type'   => 'application/json',
          'Host'           => @endpoint.host + (@endpoint.port ? ":#{@endpoint.port}" : '')
        }.merge(@dispatcher.headers),

        :body    => content,
        :timeout => -1  # for em-http-request < 1.0
      }

      cookie = get_cookies
      params[:head]['Cookie'] = cookie unless cookie == ''

      params
    end

    def create_request(params)
      version = EventMachine::HttpRequest::VERSION.split('.')[0].to_i
      options = {
        :inactivity_timeout => 0,
        :tls => {:sni_hostname => @endpoint.hostname}
      }

      if @proxy[:origin]
        uri = URI(@proxy[:origin])
        options[:proxy] = {:host => uri.host, :port => uri.port}
        if uri.user
          options[:proxy][:authorization] = [uri.user, uri.password]
        end
      end

      if version >= 1
        client = EventMachine::HttpRequest.new(@endpoint.to_s, options)
      else
        client = EventMachine::HttpRequest.new(@endpoint.to_s)
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
