module Faye
  class Server
    def initialize
      @channels = Channel::Tree.new
      @clients  = {}
    end
    
    def process(messages, options = {})
      messages = JSON.parse(messages) if String === messages
      messages = [messages] unless Array === messages
      
      options[:jsonp] ||= JSONP_CALLBACK if options.has_key?(:jsonp)
      
      responses = messages.inject([]) do |resp, msg|
        reply = handle(msg)
        reply = [reply] unless Array === reply
        resp  + reply
      end
      response = JSON.unparse(responses)
      options[:jsonp] ? "#{ options[:jsonp] }(#{ response });" : response
    end
    
    def handle(message)
      channel = message['channel']
      return __send__(Channel.parse(channel)[1], message) if Channel.meta?(channel)
      
      return [] if message['clientId'].nil?
      
      @channels.glob(message['channel']).each { |c| c << message }
      
      { :channel    => message['channel'],
        :successful => true,
        :id         => message['id'] }
    end
    
  private
    
    def generate_id
      id = Faye.random
      id = Faye.random while @clients.has_key?(id)
      connection(id).id
    end
    
    def connection(id)
      @clients[id] ||= Connection.new(id)
    end
    
    # TODO
    # * support authentication
    # * check we can support the client's connection type
    # * unsuccessful handshakes
    def handshake(message)
      id = generate_id
      
      { :channel    => Channel::HANDSHAKE,
        :version    => message['version'],
        :supportedConnectionTypes => CONNECTION_TYPES,
        :clientId   => id,
        :successful => true,
        :id         => message['id'] }
    end
    
    # TODO error messages
    def connect(message)
      client = connection(message['clientId'])
      events = client.poll_events
      
      events << { :channel    => Channel::CONNECT,
                  :successful => !client.nil?,
                  :clientId   => message['clientId'],
                  :id         => message['id'] }
      events
    end
    
    # TODO error messages
    def disconnect(message)
      id = message['clientId']
      
      client = @clients[id]
      client.disconnect!
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
      client       = connection(message['clientId'])
      subscription = message['subscription']
      
      subscription = [subscription] unless Array === subscription
      
      output = subscription.inject([]) do |list, channel|
        channel = @channels[channel] ||= Channel.new(channel)
        client.subscribe(channel)
        list << channel.name
        list
      end
      
      { :channel      => Channel::SUBSCRIBE,
        :successful   => true,
        :clientId     => client.id,
        :subscription => output,
        :id           => message['id'] }
    end
  end
end

