module Faye
  class Server
    
    include Logging
    include Extensible
    
    def initialize(options = {})
      info('New server created')
      @options     = options
      @channels    = Channel::Tree.new
      @connections = {}
      @namespace   = Namespace.new
    end
    
    def client_ids
      @connections.keys
    end
    
    def process(messages, local_or_remote = false, &callback)
      socket = local_or_remote.is_a?(WebSocket) ? local_or_remote : nil
      local  = (local_or_remote == true)
      
      debug('Processing messages from ? client', local ? 'LOCAL' : 'REMOTE')
      
      messages = [messages].flatten
      processed, responses = 0, []
      
      handle_reply = lambda do |replies|
        extended, expected = 0, replies.size
        
        replies.each_with_index do |reply, i|
          pipe_through_extensions(:outgoing, reply) do |message|
            replies[i] = message
            
            extended += 1
            if extended == expected
              
              responses.concat(replies)
              processed += 1
              callback.call(responses.compact) if processed == messages.size
            end
          end
        end
      end
      
      messages.each do |message|
        pipe_through_extensions(:incoming, message) do |piped_message|
          handle(piped_message, socket, local, &handle_reply)
        end
      end
    end
    
    def flush_connection(messages)
      [messages].flatten.each do |message|
        connection = @connections[message['clientId']]
        connection.flush! if connection
      end
    end
    
  private
    
    def connection(id)
      return @connections[id] if @connections.has_key?(id)
      connection = Connection.new(id, @options)
      connection.add_subscriber(:stale_connection, method(:destroy_connection))
      @connections[id] = connection
    end
    
    def destroy_connection(connection)
      connection.disconnect!
      connection.remove_subscriber(:stale_connection, method(:destroy_connection))
      @connections.delete(connection.id)
    end
    
    def make_response(message)
      response = {}
      %w[id clientId channel error].each do |field|
        if message[field]
          response[field] = message[field]
        end
      end
      response['successful'] = !response['error']
      response
    end
    
    def distribute_message(message)
      @channels.glob(message['channel']).each do |channel|
        channel << message
        info('Publishing message ? from client ? to ?', message['data'], message['clientId'], channel.name)
      end
    end
    
    def handle(message, socket = nil, local = false, &callback)
      return callback.call([]) if !message
      return callback.call([make_response(message)]) if message['error']
      
      distribute_message(message)
      channel_name = message['channel']
      
      if Channel.meta?(channel_name)
        handle_meta(message, socket, local, &callback)
      elsif message['clientId'].nil? or Channel.service?(channel_name)
        callback.call([])
      else
        response = make_response(message)
        response['successful'] = true
        callback.call([response])
      end
    end
    
    def handle_meta(message, socket, local, &callback)
      response = __send__(Channel.parse(message['channel'])[1], message, local)
      
      advize(response)
      
      if response['channel'] == Channel::CONNECT and response['successful'] == true
        return accept_connection(response, socket, &callback)
      end
      
      callback.call([response])
    end
    
    def accept_connection(response, socket, &callback)
      info('Accepting connection from ?', response['clientId'])
      
      connection = connection(response['clientId'])
      if socket
        return connection.socket = socket
      end
      
      connection.connect do |events|
        info('Sending event messages to ?', response['clientId'])
        debug('Events for ?: ?', response['clientId'], events)
        callback.call([response] + events)
      end
    end
    
    def advize(response)
      connection = @connections[response['clientId']]
      
      advice = response['advice'] ||= {}
      if connection
        advice['reconnect'] ||= 'retry'
        advice['interval']  ||= (connection.interval * 1000).floor
        advice['timeout']   ||= (connection.timeout * 1000).floor
      else
        advice['reconnect'] ||= 'handshake'
      end
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
      response   = make_response(message)
      
      client_id  = message['clientId']
      connection = client_id ? @connections[client_id] : nil
      connection_type = message['connectionType']
      
      response['error'] = Error.client_unknown(client_id) if connection.nil?
      response['error'] = Error.parameter_missing('clientId') if client_id.nil?
      response['error'] = Error.parameter_missing('connectionType') if connection_type.nil?
      
      response['successful'] = response['error'].nil?
      response.delete('clientId') unless response['successful']
      return response unless response['successful']
      
      response['clientId'] = connection.id
      response
    end
    
    # MUST contain  * clientId
    # MAY contain   * ext
    #               * id
    def disconnect(message, local = false)
      response   = make_response(message)
      
      client_id  = message['clientId']
      connection = client_id ? @connections[client_id] : nil
      
      response['error'] = Error.client_unknown(client_id) if connection.nil?
      response['error'] = Error.parameter_missing('clientId') if client_id.nil?
      
      response['successful'] = response['error'].nil?
      response.delete('clientId') unless response['successful']
      return response unless response['successful']
      
      destroy_connection(connection)
      
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
      connection    = client_id ? @connections[client_id] : nil
      subscription  = [message['subscription']].flatten
      
      response['error'] = Error.client_unknown(client_id) if connection.nil?
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
        connection.subscribe(channel)
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
      connection    = client_id ? @connections[client_id] : nil
      subscription  = [message['subscription']].flatten
      
      response['error'] = Error.client_unknown(client_id) if connection.nil?
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
        connection.unsubscribe(channel)
      end
      
      response['successful'] = response['error'].nil?
      response
    end
    
  end
end

