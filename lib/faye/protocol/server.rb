module Faye
  class Server

    autoload :Socket, File.join(ROOT, 'faye', 'protocol', 'socket')

    include Logging
    include Extensible

    attr_reader :engine

    def initialize(options = {})
      @options    = options || {}
      engine_opts = @options[:engine] || {}
      engine_opts[:timeout] = @options[:timeout]
      @engine     = Faye::Engine.get(engine_opts)

      info('Created new server: ?', @options)
    end

    def close
      @engine.close
    end

    def open_socket(client_id, socket, env)
      return unless client_id and socket
      @engine.open_socket(client_id, Socket.new(self, socket, env))
    end

    def close_socket(client_id, close = true)
      @engine.flush_connection(client_id, close)
    end

    def process(messages, env, &callback)
      local    = env.nil?
      messages = [messages].flatten
      info('Processing messages: ? (local: ?)', messages, local)

      return callback.call([]) if messages.size == 0
      processed, responses = 0, []

      gather_replies = lambda do |replies|
        responses.concat(replies)
        processed += 1
        responses.compact!
        info('Returning replies: ?', responses)
        callback.call(responses) if processed == messages.size
      end

      handle_reply = lambda do |replies|
        extended, expected = 0, replies.size
        gather_replies.call(replies) if expected == 0

        replies.each_with_index do |reply, i|
          debug('Processing reply: ?', reply)
          pipe_through_extensions(:outgoing, reply, env) do |message|
            replies[i] = message
            extended  += 1
            gather_replies.call(replies) if extended == expected
          end
        end
      end

      messages.each do |message|
        pipe_through_extensions(:incoming, message, env) do |piped_message|
          handle(piped_message, local, &handle_reply)
        end
      end
    end

    def make_response(message)
      response = {}

      response['id']       = message['id']       if message['id']
      response['clientId'] = message['clientId'] if message['clientId']
      response['channel']  = message['channel']  if message['channel']
      response['error']    = message['error']    if message['error']

      response['successful'] = !response['error']
      response
    end

    def handle(message, local = false, &callback)
      return callback.call([]) if !message
      info('Handling message: ? (local: ?)', message, local)

      channel_name = message['channel']
      error        = message['error']

      return handle_meta(message, local, &callback) if Channel.meta?(channel_name)

      if Grammar::CHANNEL_NAME !~ channel_name
        error = Faye::Error.channel_invalid(channel_name)
      end

      if message['data'].nil?
        error = Faye::Error.parameter_missing('data')
      end

      @engine.publish(message) unless error

      response = make_response(message)
      response['error'] = error if error
      response['successful'] = !response['error']
      callback.call([response])
    end

    def handle_meta(message, local, &callback)
      method = method_for(message)

      unless method
        response = make_response(message)
        response['error'] = Faye::Error.channel_forbidden(message['channel'])
        response['successful'] = false
        return callback.call([response])
      end

      __send__(method, message, local) do |responses|
        responses = [responses].flatten
        responses.each { |r| advize(r, message['connectionType']) }
        callback.call(responses)
      end
    end

    def method_for(message)
      case message['channel']
      when Channel::HANDSHAKE   then :handshake
      when Channel::CONNECT     then :connect
      when Channel::SUBSCRIBE   then :subscribe
      when Channel::UNSUBSCRIBE then :unsubscribe
      when Channel::DISCONNECT  then :disconnect
      end
    end

    def advize(response, connection_type)
      return unless [Channel::HANDSHAKE, Channel::CONNECT].include?(response['channel'])

      if connection_type == 'eventsource'
        interval = (@engine.timeout * 1000).floor
        timeout  = 0
      else
        interval = (@engine.interval * 1000).floor
        timeout  = (@engine.timeout * 1000).floor
      end

      advice = response['advice'] ||= {}
      if response['error']
        advice['reconnect'] ||= 'handshake'
      else
        advice['reconnect'] ||= 'retry'
        advice['interval']  ||= interval
        advice['timeout']   ||= timeout
      end
    end

    # MUST contain  * version
    #               * supportedConnectionTypes
    # MAY contain   * minimumVersion
    #               * ext
    #               * id
    def handshake(message, local = false, &callback)
      response = make_response(message)
      response['version'] = BAYEUX_VERSION

      response['error'] = Error.parameter_missing('version') if message['version'].nil?

      client_conns = message['supportedConnectionTypes']

      response['supportedConnectionTypes'] = CONNECTION_TYPES

      if client_conns
        common_conns = client_conns.select { |c| CONNECTION_TYPES.include?(c) }
        response['error'] = Error.conntype_mismatch(*client_conns) if common_conns.empty?
      else
        response['error'] = Error.parameter_missing('supportedConnectionTypes')
      end

      response['successful'] = response['error'].nil?
      return callback.call(response) unless response['successful']

      @engine.create_client do |client_id|
        response['clientId'] = client_id
        callback.call(response)
      end
    end

    # MUST contain  * clientId
    #               * connectionType
    # MAY contain   * ext
    #               * id
    def connect(message, local = false, &callback)
      response        = make_response(message)
      client_id       = message['clientId']
      connection_type = message['connectionType']

      @engine.client_exists(client_id) do |exists|
        response['error'] = Error.client_unknown(client_id) unless exists
        response['error'] = Error.parameter_missing('clientId') if client_id.nil?

        unless CONNECTION_TYPES.include?(connection_type)
          response['error'] = Error.conntype_mismatch(connection_type)
        end

        response['error'] = Error.parameter_missing('connectionType') if connection_type.nil?

        response['successful'] = response['error'].nil?

        if !response['successful']
          response.delete('clientId')
          next callback.call(response)
        end

        if message['connectionType'] == 'eventsource'
          message['advice'] ||= {}
          message['advice']['timeout'] = 0
        end

        @engine.connect(response['clientId'], message['advice']) do |events|
          callback.call([response] + events)
        end
      end
    end

    # MUST contain  * clientId
    # MAY contain   * ext
    #               * id
    def disconnect(message, local = false, &callback)
      response   = make_response(message)
      client_id  = message['clientId']

      @engine.client_exists(client_id) do |exists|
        response['error'] = Error.client_unknown(client_id) unless exists
        response['error'] = Error.parameter_missing('clientId') if client_id.nil?

        response['successful'] = response['error'].nil?
        response.delete('clientId') unless response['successful']

        @engine.destroy_client(client_id) if response['successful']
        callback.call(response)
      end
    end

    # MUST contain  * clientId
    #               * subscription
    # MAY contain   * ext
    #               * id
    def subscribe(message, local = false, &callback)
      response     = make_response(message)
      client_id    = message['clientId']
      subscription = [message['subscription']].flatten

      @engine.client_exists(client_id) do |exists|
        response['error'] = Error.client_unknown(client_id) unless exists
        response['error'] = Error.parameter_missing('clientId') if client_id.nil?
        response['error'] = Error.parameter_missing('subscription') if message['subscription'].nil?

        response['subscription'] = message['subscription'] || []

        subscription.each do |channel|
          next if response['error']
          response['error'] = Error.channel_forbidden(channel) unless local or Channel.subscribable?(channel)
          response['error'] = Error.channel_invalid(channel) unless Channel.valid?(channel)

          next if response['error']
          @engine.subscribe(client_id, channel)
        end

        response['successful'] = response['error'].nil?
        callback.call(response)
      end
    end

    # MUST contain  * clientId
    #               * subscription
    # MAY contain   * ext
    #               * id
    def unsubscribe(message, local = false, &callback)
      response     = make_response(message)
      client_id    = message['clientId']
      subscription = [message['subscription']].flatten

      @engine.client_exists(client_id) do |exists|
        response['error'] = Error.client_unknown(client_id) unless exists
        response['error'] = Error.parameter_missing('clientId') if client_id.nil?
        response['error'] = Error.parameter_missing('subscription') if message['subscription'].nil?

        response['subscription'] = message['subscription'] || []

        subscription.each do |channel|
          next if response['error']
          response['error'] = Error.channel_forbidden(channel) unless local or Channel.subscribable?(channel)
          response['error'] = Error.channel_invalid(channel) unless Channel.valid?(channel)

          next if response['error']
          @engine.unsubscribe(client_id, channel)
        end

        response['successful'] = response['error'].nil?
        callback.call(response)
      end
    end

  end
end
