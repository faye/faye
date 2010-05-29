module Faye
  class Server
    
    include Logging
    
    def initialize(options = {})
      info('New server created')
      @options   = options
      @channels  = Channel::Tree.new
      @clients   = {}
      @namespace = Namespace.new
    end
    
    # Notifies the server of stale connections that should be deleted
    def update(message, client)
      return unless message == :stale_client
      destroy_client(client)
    end
    
    def client_ids
      @clients.keys
    end
    
    def process(messages, local = false, &callback)
      debug('Processing messages from ? client', local ? 'LOCAL' : 'REMOTE')
      
      messages = [messages].flatten
      processed, responses = 0, []
      
      messages.each do |message|
        handle(message, local) do |reply|
          reply = [reply].flatten
          responses.concat(reply)
          processed += 1
          callback[responses] if processed == messages.size
        end
      end
    end
    
    def flush_connection(messages)
      [messages].flatten.each do |message|
        client = @clients[message['clientId']]
        client.flush! if client
      end
    end
    
  private
    
    def connection(id)
      return @clients[id] if @clients.has_key?(id)
      client = Connection.new(id, @options)
      client.add_observer(self)
      @clients[id] = client
    end
    
    def destroy_client(client)
      client.disconnect!
      client.delete_observer(self)
      @clients.delete(client.id)
    end
    
    def handle(message, local = false, &callback)
      channel = message['channel']
      
      @channels.glob(channel).each do |channel|
        channel << message
        info('Publishing message ? from client ? to ?', message['data'], message['clientId'], channel.name)
      end
      
      if Channel.meta?(channel)
        response = __send__(Channel.parse(channel)[1], message, local)
        
        client_id = response['clientId']
        response['advice'] ||= {}
        response['advice']['reconnect'] ||= @clients.has_key?(client_id) ? 'retry' : 'handshake'
        response['advice']['interval']  ||= (Connection::INTERVAL * 1000).floor
        
        return callback.call(response) unless response['channel'] == Channel::CONNECT and
                                              response['successful'] == true
        
        info('Accepting connection from ?', response['clientId'])
        
        return connection(response['clientId']).connect do |events|
          info('Sending event messages to ?', response['clientId'])
          debug('Events for ?: ?', response['clientId'], events)
          callback.call([response] + events)
        end
      end
      
      return callback.call([]) if message['clientId'].nil? or Channel.service?(channel)
      
      response = make_response(message)
      response['successful'] = true
      callback.call(response)
    end
    
    def make_response(message)
      response = {}
      %w[id clientId channel].each do |field|
        if message[field]
          response[field] = message[field]
        end
      end
      response
    end
    
    # MUST contain  * version
    #               * supportedConnectionTypes
    # MAY contain   * minimumVersion
    #               * ext
    #               * id
    def handshake(message, local = false)
      response = make_response(message)
      response['version'] = BAYEUX_VERSION
      
      response['error'] = Error.parameter_missing('version') if message['version'].nil?
      
      client_conns = message['supportedConnectionTypes']
      
      unless local
        response['supportedConnectionTypes'] = CONNECTION_TYPES
        
        if client_conns
          common_conns = client_conns.select { |c| CONNECTION_TYPES.include?(c) }
          response['error'] = Error.conntype_mismatch(*client_conns) if common_conns.empty?
        else
          response['error'] = Error.parameter_missing('supportedConnectionTypes')
        end
      end
      
      response['successful'] = response['error'].nil?
      return response unless response['successful']
      
      client_id = @namespace.generate
      response['clientId'] = connection(client_id).id
      info('Accepting handshake from client ?', response['clientId'])
      response
    end
    
    # MUST contain  * clientId
    #               * connectionType
    # MAY contain   * ext
    #               * id
    def connect(message, local = false)
      response  = make_response(message)
      
      client_id = message['clientId']
      client    = client_id ? @clients[client_id] : nil
      connection_type = message['connectionType']
      
      response['error'] = Error.client_unknown(client_id) if client.nil?
      response['error'] = Error.parameter_missing('clientId') if client_id.nil?
      response['error'] = Error.parameter_missing('connectionType') if connection_type.nil?
      
      response['successful'] = response['error'].nil?
      response.delete('clientId') unless response['successful']
      return response unless response['successful']
      
      response['clientId'] = client.id
      response
    end
    
    # MUST contain  * clientId
    # MAY contain   * ext
    #               * id
    def disconnect(message, local = false)
      response  = make_response(message)
      
      client_id = message['clientId']
      client    = client_id ? @clients[client_id] : nil
      
      response['error'] = Error.client_unknown(client_id) if client.nil?
      response['error'] = Error.parameter_missing('clientId') if client_id.nil?
      
      response['successful'] = response['error'].nil?
      response.delete('clientId') unless response['successful']
      return response unless response['successful']
      
      destroy_client(client)
      
      info('Disconnected client: ?', client_id)
      response['clientId'] = client_id
      response
    end
    
    # MUST contain  * clientId
    #               * subscription
    # MAY contain   * ext
    #               * id
    def subscribe(message, local = false)
      response      = make_response(message)
      
      client_id     = message['clientId']
      client        = client_id ? @clients[client_id] : nil
      
      subscription  = message['subscription']
      subscription  = [subscription].flatten
      
      response['error'] = Error.client_unknown(client_id) if client.nil?
      response['error'] = Error.parameter_missing('clientId') if client_id.nil?
      response['error'] = Error.parameter_missing('subscription') if message['subscription'].nil?
      
      response['subscription'] = subscription.compact
      
      subscription.each do |channel|
        next if response['error']
        response['error'] = Error.channel_forbidden(channel) unless local or Channel.subscribable?(channel)
        response['error'] = Error.channel_invalid(channel) unless Channel.valid?(channel)
        
        next if response['error']
        channel = @channels[channel] ||= Channel.new(channel)
        
        info('Subscribing client ? to ?', client_id, channel.name)
        client.subscribe(channel)
      end
      
      response['successful'] = response['error'].nil?
      response
    end
    
    # MUST contain  * clientId
    #               * subscription
    # MAY contain   * ext
    #               * id
    def unsubscribe(message, local = false)
      response      = make_response(message)
      
      client_id     = message['clientId']
      client        = client_id ? @clients[client_id] : nil
      
      subscription  = message['subscription']
      subscription  = [subscription].flatten
      
      response['error'] = Error.client_unknown(client_id) if client.nil?
      response['error'] = Error.parameter_missing('clientId') if client_id.nil?
      response['error'] = Error.parameter_missing('subscription') if message['subscription'].nil?
      
      response['subscription'] = subscription.compact
      
      subscription.each do |channel|
        next if response['error']
        
        unless Channel.valid?(channel)
          response['error'] = Error.channel_invalid(channel)
          next
        end
        
        channel = @channels[channel]
        next unless channel
        
        info('Unsubscribing client ? from ?', client_id, channel.name)
        client.unsubscribe(channel)
      end
      
      response['successful'] = response['error'].nil?
      response
    end
    
  end
end

