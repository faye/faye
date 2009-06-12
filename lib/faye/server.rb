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
      
      if Channel.meta?(channel)
        response = __send__(Channel.parse(channel)[1], message)
        return response unless response['channel'] == Channel::CONNECT and response['successful'] = true
        events = connection(response['clientId']).poll_events
        return [response] + events
      end
      
      return [] if message['clientId'].nil?
      
      @channels.glob(message['channel']).each { |c| c << message }
      
      { 'channel'     => message['channel'],
        'successful'  => true,
        'id'          => message['id'] }
    end
    
    # MUST contain  * version
    #               * supportedConnectionTypes
    # MAY contain   * minimumVersion
    #               * ext
    #               * id
    def handshake(message)
      response =  { 'channel' => Channel::HANDSHAKE,
                    'version' => BAYEUX_VERSION,
                    'supportedConnectionTypes' => CONNECTION_TYPES,
                    'id'      => message['id'] }
      
      response['error'] = Error.parameter_missing('Missing version') if
                          message['version'].nil?
      
      client_conns = message['supportedConnectionTypes']
      if client_conns
        common_conns = client_conns.select { |c| CONNECTION_TYPES.include?(c) }
        response['error'] = Error.conntype_mismatch(
                            "Server does not support connection types {#{ client_conns * ', ' }}") if
                            common_conns.empty?
      else
        response['error'] = Error.parameter_missing('Missing supportedConnectionTypes')
      end
      
      response['successful'] = response['error'].nil?
      return response unless response['successful']
      
      response['clientId'] = generate_id
      response
    end
    
    # MUST contain  * clientId
    #               * connectionType
    # MAY contain   * ext
    #               * id
    def connect(message)
      response  = { 'channel' => Channel::CONNECT,
                    'id'      => message['id'] }
      client_id = message['clientId']
      
      response['error'] = Error.parameter_missing('Missing clientId') if
                          client_id.nil?
      
      response['error'] = Error.parameter_missing('Missing connectionType') if
                          message['connectionType'].nil?
      
      response['successful'] = response['error'].nil?
      return response unless response['successful']
      
      client = connection(client_id)
      response['clientId'] = client.id
      response
    end
    
    # MUST contain  * clientId
    # MAY contain   * ext
    #               * id
    def disconnect(message)
      response  = { 'channel' => Channel::DISCONNECT,
                    'id'      => message['id'] }
      client_id = message['clientId']
      client    = client_id ? @clients[client_id] : nil
      
      response['error'] = Error.client_unknown("Unknown client ID #{client_id}") if
                          client.nil?
      
      response['error'] = Error.parameter_missing('Missing clientId') if
                          client_id.nil?
      
      response['successful'] = response['error'].nil?
      return response unless response['successful']
      
      client.disconnect!
      @clients.delete(client_id)
      
      response['clientId'] = client_id
      response
    end
    
    # MUST contain  * clientId
    #               * subscription
    # MAY contain   * ext
    #               * id
    def subscribe(message)
      response      = { 'channel'   => Channel::SUBSCRIBE,
                        'clientId'  => message['clientId'],
                        'id'        => message['id'] }
      
      client_id     = message['clientId']
      client        = client_id ? @clients[client_id] : nil
      
      subscription  = message['subscription']
      subscription  = [subscription] unless Array === subscription
      
      response['error'] = Error.client_unknown("Unknown client ID #{client_id}") if
                          client.nil?
      
      response['error'] = Error.parameter_missing('Missing clientId') if
                          client_id.nil?
      
      response['error'] = Error.parameter_missing('Missing subscription') if
                          message['subscription'].nil?
      
      response['subscription'] = []
      
      subscription.each do |channel|
        next if response['error']
        
        if not Channel.valid?(channel)
          response['error'] = Error.channel_invalid("Invalid channel '#{channel}'")
          next
        end
        
        channel = @channels[channel] ||= Channel.new(channel)
        client.subscribe(channel)
        response['subscription'] << channel.name
      end
      
      response['successful'] = response['error'].nil?
      response
    end
    
    def client_ids
      @clients.keys
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

