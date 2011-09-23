require 'cookiejar'
require 'em-http'
require 'em-http/version'

module Faye
  
  class Transport::Http < Transport
    def self.usable?(endpoint, &callback)
      callback.call(endpoint.is_a?(String))
    end
    
    def request(message, timeout)
      retry_block = retry_block(message, timeout)
      
      @client.cookies ||= CookieJar::Jar.new
      cookies = @client.cookies.get_cookies(@endpoint)
      
      content = JSON.unparse(message)
      params = {
        :head => {
          'Content-Length'  => content.length,
          'Content-Type'    => 'application/json',
          'Cookie'          => cookies * '; ',
          'Host'            => URI.parse(@endpoint).host
        },
        :body    => content,
        :timeout => -1  # for em-http-request < 1.0
      }
      if EventMachine::HttpRequest::VERSION.split('.')[0].to_i >= 1
        options = {   # for em-http-request >= 1.0
          :inactivity_timeout => 0,    # connection inactivity (post-setup) timeout (0 = disable timeout)
        }
        request = EventMachine::HttpRequest.new(@endpoint, options).post(params)
      else
        request = EventMachine::HttpRequest.new(@endpoint).post(params)
      end
      request.callback do
        begin
          cookies = [request.response_header['SET_COOKIE']].flatten.compact
          cookies.each do |cookie|
            @client.cookies.set_cookie(@endpoint, cookie)
          end
          receive(JSON.parse(request.response))
        rescue
          retry_block.call
        end
      end
      request.errback { retry_block.call }
    end
  end
  
  Transport.register 'long-polling', Transport::Http
  
end
