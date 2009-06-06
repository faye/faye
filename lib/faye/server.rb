module Faye
  class Server
    def initialize
      @clients  = {}
      @channels = {}
    end
    
    def generate_id
      id = Faye.random
      id = Faye.random while @clients.has_key?(id)
      id
    end
    
    def ids
      @clients.keys
    end
    
    def process(messages)
      messages = JSON.parse(messages) if String === messages
      messages = [messages] unless Array === messages
      
      responses = messages.inject([]) do |resp, msg|
        resp << handle(msg)
        resp
      end
      JSON.unparse(responses)
    end
    
    def handle(message)
      return handshake(message) if handshake?(message)
    end
    
    def handshake?(message)
      message['channel'] == Channel::HANDSHAKE
    end
    
    # TODO
    # * support authentication
    # * unsuccessful handshakes
    def handshake(message)
      id = generate_id
      @clients[id] = Client.new
      
      { :channel    => Channel::HANDSHAKE,
        :version    => message['version'],
        :supportedConnectionTypes => message['supportedConnectionTypes'],
        :clientId   => id,
        :successful => true,
        :id         => message['id'] }
    end
  end
end

