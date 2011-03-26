module Faye
  
  class Transport::Http < Transport
    def self.usable?(endpoint)
      endpoint.is_a?(String)
    end
    
    def request(message, timeout)
      retry_block = retry_block(message, timeout)
      
      content = JSON.unparse(message)
      params = {
        :head => {
          'Content-Type'    => 'application/json',
          'host'            => URI.parse(@endpoint).host,
          'Content-Length'  => content.length
        },
        :body    => content,
        :timeout => -1
      }
      request = EventMachine::HttpRequest.new(@endpoint).post(params)
      request.callback do
        begin
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
