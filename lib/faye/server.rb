module Faye
  class Server
    def initialize
      @channels = Channel::Tree.new
      @clients  = {}
    end
    
    def destroy!
      @clients.each { |id, client| client.disconnect! }
      @clients.clear
    end
    
    def process(messages, options = {})
      messages = [messages] unless Array === messages
      
      responses = messages.inject([]) do |resp, msg|
        reply = handle(msg)
        reply = [reply] unless Array === reply
        resp  + reply
      end
      
      responses
    end
    
    def handle(message)
      channel = message['channel']
      return __send__(Channel.parse(channel)[1], message) if Channel.meta?(channel)
      
      return [] if message['clientId'].nil?
      
      @channels.glob(message['channel']).each { |c| c << message }
      
      { 'channel'     => message['channel'],
        'successful'  => true,
        'id'          => message['id'] }
    end
    
    def handshake(message)
      response =  { 'channel' => Channel::HANDSHAKE,
                    'version' => BAYEUX_VERSION,
                    'supportedConnectionTypes' => CONNECTION_TYPES,
                    'id'      => message['id'] }
      
      response['error'] = Error.version_mismatch('Missing version') if
                          message['version'].nil?
      
      client_conns = message['supportedConnectionTypes']
      if client_conns
        common_conns = client_conns.select { |c| CONNECTION_TYPES.include?(c) }
        response['error'] = Error.conntype_mismatch(
                            "Server does not support connection types {#{ client_conns * ', ' }}") if
                            common_conns.empty?
      else
        response['error'] = Error.conntype_mismatch('Missing supportedConnectionTypes')
      end
      
      response['successful'] = response['error'].nil?
      return response unless response['successful']
      
      response.update('clientId' => generate_id)
      response
    end
    
    def connect(message)
      client = connection(message['clientId'])
      events = client.poll_events
      
      events << { 'channel'     => Channel::CONNECT,
                  'successful'  => !client.nil?,
                  'clientId'    => message['clientId'],
                  'id'          => message['id'] }
      events
    end
    
    def disconnect(message)
      id = message['clientId']
      
      client = @clients[id]
      client.disconnect!
      @clients.delete(id)
      
      { 'channel'     => Channel::DISCONNECT,
        'successful'  => !client.nil?,
        'clientId'    => id,
        'id'          => message['id'] }
    end
    
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
      
      { 'channel'       => Channel::SUBSCRIBE,
        'successful'    => true,
        'clientId'      => client.id,
        'subscription'  => output,
        'id'            => message['id'] }
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
  end
end

