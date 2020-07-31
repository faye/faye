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
      headers = {
        'Content-Length' => content.bytesize,
        'Content-Type'   => 'application/json',
        'Host'           => @endpoint.host + (@endpoint.port ? ":#{ @endpoint.port }" : '')
      }

      params = {
        :head => headers.merge(@dispatcher.headers),
        :body => content
      }

      cookie = get_cookies
      params[:head]['Cookie'] = cookie unless cookie == ''

      params
    end

    def create_request(params)
      options = {
        :inactivity_timeout => 0,
        :tls => @dispatcher.tls
      }

      if @proxy[:origin]
        uri = URI(@proxy[:origin])
        options[:proxy] = { :host => uri.host, :port => uri.port }
        if uri.user
          options[:proxy][:authorization] = [uri.user, uri.password]
        end
      end

      client = EventMachine::HttpRequest.new(@endpoint.to_s, options)
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
