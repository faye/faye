module Faye
  class Server
    def initialize
      @clients  = {}
      @subscriptions = {}
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
      
      options[:jsonp] ||= JSONP_CALLBACK if options.has_key?(:jsonp)
      
      responses = messages.inject([]) do |resp, msg|
        resp << handle(msg)
        resp
      end
      response = JSON.unparse(responses)
      options[:jsonp] ? "#{ options[:jsonp] }(#{ response });" : response
    end
    
    def handle(message)
      channel = message['channel']
      if Channel.meta?(channel)
        return __send__(Channel.parse(channel)[1], message)
      end
    end
    
    # TODO
    # * support authentication
    # * check we can support the client's connection type
    # * unsuccessful handshakes
    def handshake(message)
      id = generate_id
      @clients[id] = Connection.new(id)
      
      { :channel    => Channel::HANDSHAKE,
        :version    => message['version'],
        :supportedConnectionTypes => CONNECTION_TYPES,
        :clientId   => id,
        :successful => true,
        :id         => message['id'] }
    end
    
    # TODO error messages
    def connect(message)
      id = message['clientId']
      client = @clients[id]
      
      { :channel    => Channel::CONNECT,
        :successful => !client.nil?,
        :clientId   => id,
        :id         => message['id'] }
    end
    
    # TODO error messages
    def disconnect(message)
      id = message['clientId']
      client = @clients[id]
      @clients.delete(id)
      
      { :channel    => Channel::DISCONNECT,
        :successful => !client.nil?,
        :clientId   => id,
        :id         => message['id'] }
    end
    
    # TODO
    # * error messages
    # * deliver pending events for the new subscription
    def subscribe(message)
      client       = @clients[message['clientId']]
      subscription = message['subscription']
      
      subscription = [subscription] unless Array === subscription
      
      subscription.each do |channel|
        sub = @subscriptions[channel] ||= Subscription.new(channel)
        sub.add_recipient(client)
      end
      
      { :channel      => Channel::SUBSCRIBE,
        :successful   => true,
        :clientId     => client.id,
        :subscription => subscription,
        :id           => message['id'] }
    end
  end
end

