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
    
    def process(messages, options = {})
      messages = JSON.parse(messages) if String === messages
      messages = [messages] unless Array === messages
      
      responses = messages.inject([]) do |resp, msg|
        resp << handle(msg)
        resp
      end
      response = JSON.unparse(responses)
      options[:jsonp] ? "#{ options[:jsonp] }(#{ response });" : response
    end
    
    def handle(message)
      return handshake(message)   if handshake?(message)
      return connect(message)     if connect?(message)
      return disconnect(message)  if disconnect?(message)
    end
    
    def handshake?(message)
      message['channel'] == Channel::HANDSHAKE
    end
    
    def connect?(message)
      message['channel'] == Channel::CONNECT
    end
    
    def disconnect?(message)
      message['channel'] == Channel::DISCONNECT
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
    
    def connect(message)
      id = message['clientId']
      client = @clients[id]
      
      { :channel    => Channel::CONNECT,
        :successful => !client.nil?,
        :clientId   => id }
    end
    
    def disconnect(message)
      id = message['clientId']
      client = @clients[id]
      @clients.delete(id)
      
      { :channel    => Channel::DISCONNECT,
        :successful => !client.nil?,
        :clientId   => id }
    end
  end
end

