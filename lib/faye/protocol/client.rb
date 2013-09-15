module Faye
  class Client

    include Deferrable
    include Publisher
    include Logging
    include Extensible

    UNCONNECTED         = 1
    CONNECTING          = 2
    CONNECTED           = 3
    DISCONNECTED        = 4

    HANDSHAKE           = 'handshake'
    RETRY               = 'retry'
    NONE                = 'none'

    CONNECTION_TIMEOUT  = 60.0
    DEFAULT_RETRY       = 5.0
    MAX_REQUEST_SIZE    = 2048

    attr_reader :cookies, :endpoint, :endpoints, :headers, :max_request_size, :retry, :transports

    def initialize(endpoint = nil, options = {})
      super()
      info('New client created for ?', endpoint)

      @options    = options
      @endpoint   = Faye.parse_url(endpoint || RackAdapter::DEFAULT_ENDPOINT)
      @endpoints  = @options[:endpoints] || {}
      @transports = {}
      @cookies    = CookieJar::Jar.new
      @headers    = {}
      @disabled   = []
      @retry      = @options[:retry] || DEFAULT_RETRY

      @endpoints.each do |key, value|
        @endpoints[key] = Faye.parse_url(value)
      end

      @max_request_size = MAX_REQUEST_SIZE

      @state      = UNCONNECTED
      @channels   = Channel::Set.new
      @message_id = 0

      @response_callbacks = {}

      @advice = {
        'reconnect' => RETRY,
        'interval'  => 1000.0 * (@options[:interval] || Engine::INTERVAL),
        'timeout'   => 1000.0 * (@options[:timeout]  || CONNECTION_TIMEOUT)
      }
    end

    def disable(feature)
      @disabled << feature
    end

    def set_header(name, value)
      @headers[name.to_s] = value.to_s
    end

    # Request
    # MUST include:  * channel
    #                * version
    #                * supportedConnectionTypes
    # MAY include:   * minimumVersion
    #                * ext
    #                * id
    #
    # Success Response                             Failed Response
    # MUST include:  * channel                     MUST include:  * channel
    #                * version                                    * successful
    #                * supportedConnectionTypes                   * error
    #                * clientId                    MAY include:   * supportedConnectionTypes
    #                * successful                                 * advice
    # MAY include:   * minimumVersion                             * version
    #                * advice                                     * minimumVersion
    #                * ext                                        * ext
    #                * id                                         * id
    #                * authSuccessful
    def handshake(&block)
      return if @advice['reconnect'] == NONE
      return if @state != UNCONNECTED

      @state = CONNECTING

      info('Initiating handshake with ?', @endpoint)
      select_transport(MANDATORY_CONNECTION_TYPES)

      send({
        'channel'                   => Channel::HANDSHAKE,
        'version'                   => BAYEUX_VERSION,
        'supportedConnectionTypes'  => [@transport.connection_type]

      }) do |response|

        if response['successful']
          @state     = CONNECTED
          @client_id = response['clientId']

          select_transport(response['supportedConnectionTypes'])

          info('Handshake successful: ?', @client_id)

          subscribe(@channels.keys, true)
          block.call if block_given?

        else
          info('Handshake unsuccessful')
          EventMachine.add_timer(@advice['interval'] / 1000.0) { handshake(&block) }
          @state = UNCONNECTED
        end
      end
    end

    # Request                              Response
    # MUST include:  * channel             MUST include:  * channel
    #                * clientId                           * successful
    #                * connectionType                     * clientId
    # MAY include:   * ext                 MAY include:   * error
    #                * id                                 * advice
    #                                                     * ext
    #                                                     * id
    #                                                     * timestamp
    def connect(&block)
      return if @advice['reconnect'] == NONE or
                @state == DISCONNECTED

      return handshake { connect(&block) } if @state == UNCONNECTED

      callback(&block)
      return unless @state == CONNECTED

      info('Calling deferred actions for ?', @client_id)
      set_deferred_status(:succeeded)
      set_deferred_status(:unknown)

      return unless @connect_request.nil?
      @connect_request = true

      info('Initiating connection for ?', @client_id)

      send({
        'channel'         => Channel::CONNECT,
        'clientId'        => @client_id,
        'connectionType'  => @transport.connection_type

      }) do
        cycle_connection
      end
    end

    # Request                              Response
    # MUST include:  * channel             MUST include:  * channel
    #                * clientId                           * successful
    # MAY include:   * ext                                * clientId
    #                * id                  MAY include:   * error
    #                                                     * ext
    #                                                     * id
    def disconnect
      return unless @state == CONNECTED
      @state = DISCONNECTED

      info('Disconnecting ?', @client_id)

      send({
        'channel'   => Channel::DISCONNECT,
        'clientId'  => @client_id

      }) do |response|
        @transport.close if response['successful']
      end

      info('Clearing channel listeners for ?', @client_id)
      @channels = Channel::Set.new
    end

    # Request                              Response
    # MUST include:  * channel             MUST include:  * channel
    #                * clientId                           * successful
    #                * subscription                       * clientId
    # MAY include:   * ext                                * subscription
    #                * id                  MAY include:   * error
    #                                                     * advice
    #                                                     * ext
    #                                                     * id
    #                                                     * timestamp
    def subscribe(channel, force = false, &block)
      if Array === channel
        return channel.map { |c| subscribe(c, force, &block) }
      end

      subscription  = Subscription.new(self, channel, block)
      has_subscribe = @channels.has_subscription?(channel)

      if has_subscribe and not force
        @channels.subscribe([channel], block)
        subscription.set_deferred_status(:succeeded)
        return subscription
      end

      connect {
        info('Client ? attempting to subscribe to ?', @client_id, channel)
        @channels.subscribe([channel], block) unless force

        send({
          'channel'       => Channel::SUBSCRIBE,
          'clientId'      => @client_id,
          'subscription'  => channel

        }) do |response|
          unless response['successful']
            subscription.set_deferred_status(:failed, Error.parse(response['error']))
            next @channels.unsubscribe(channel, block)
          end

          channels = [response['subscription']].flatten
          info('Subscription acknowledged for ? to ?', @client_id, channels)
          subscription.set_deferred_status(:succeeded)
        end
      }
      subscription
    end

    # Request                              Response
    # MUST include:  * channel             MUST include:  * channel
    #                * clientId                           * successful
    #                * subscription                       * clientId
    # MAY include:   * ext                                * subscription
    #                * id                  MAY include:   * error
    #                                                     * advice
    #                                                     * ext
    #                                                     * id
    #                                                     * timestamp
    def unsubscribe(channel, &block)
      if Array === channel
        return channel.map { |c| unsubscribe(c, &block) }
      end

      dead = @channels.unsubscribe(channel, block)
      return unless dead

      connect {
        info('Client ? attempting to unsubscribe from ?', @client_id, channel)

        send({
          'channel'       => Channel::UNSUBSCRIBE,
          'clientId'      => @client_id,
          'subscription'  => channel

        }) do |response|
          next unless response['successful']

          channels = [response['subscription']].flatten
          info('Unsubscription acknowledged for ? from ?', @client_id, channels)
        end
      }
    end

    # Request                              Response
    # MUST include:  * channel             MUST include:  * channel
    #                * data                               * successful
    # MAY include:   * clientId            MAY include:   * id
    #                * id                                 * error
    #                * ext                                * ext
    def publish(channel, data)
      publication = Publication.new
      connect {
        info('Client ? queueing published message to ?: ?', @client_id, channel, data)

        send({
          'channel'   => channel,
          'data'      => data,
          'clientId'  => @client_id

        }) do |response|
          if response['successful']
            publication.set_deferred_status(:succeeded)
          else
            publication.set_deferred_status(:failed, Error.parse(response['error']))
          end
        end
      }
      publication
    end

    def receive_message(message)
      id = message['id']

      if message.has_key?('successful')
        callback = @response_callbacks.delete(id)
      end

      pipe_through_extensions(:incoming, message, nil) do |message|
        next unless message

        handle_advice(message['advice']) if message['advice']
        deliver_message(message)

        callback.call(message) if callback
      end

      return if @transport_up == true
      @transport_up = true
      trigger('transport:up')
    end

    def message_error(messages, immediate = false)
      messages.each do |message|
        id = message['id']

        if immediate
          transport_send(message)
        else
          EventMachine.add_timer(@retry) { transport_send(message) }
        end
      end

      return if immediate or @transport_up == false
      @transport_up = false
      trigger('transport:down')
    end

  private

    def select_transport(transport_types)
      Transport.get(self, transport_types, @disabled) do |transport|
        debug('Selected ? transport for ?', transport.connection_type, transport.endpoint)

        next if transport == @transport
        @transport.close if @transport

        @transport = transport
      end
    end

    def send(message, &callback)
      return unless @transport
      message['id'] = generate_message_id

      pipe_through_extensions(:outgoing, message, nil) do |message|
        next unless message
        @response_callbacks[message['id']] = callback if callback
        transport_send(message)
      end
    end

    def transport_send(message)
      return unless @transport

      timeout = [nil, 0].include?(@advice['timeout']) ?
                1.2 * @retry :
                1.2 * @advice['timeout'] / 1000.0

      envelope = Envelope.new(message, timeout)

      envelope.errback do |immediate|
        message_error([message], immediate)
      end

      @transport.send(envelope)
    end

    def generate_message_id
      @message_id += 1
      @message_id = 0 if @message_id >= 2**32
      @message_id.to_s(36)
    end

    def handle_advice(advice)
      @advice.update(advice)

      if @advice['reconnect'] == HANDSHAKE and @state != DISCONNECTED
        @state     = UNCONNECTED
        @client_id = nil
        cycle_connection
      end
    end

    def deliver_message(message)
      return unless message.has_key?('channel') and message.has_key?('data')
      info('Client ? calling listeners for ? with ?', @client_id, message['channel'], message['data'])
      @channels.distribute_message(message)
    end

    def cycle_connection
      if @connect_request
        @connect_request = nil
        info('Closed connection for ?', @client_id)
      end
      EventMachine.add_timer(@advice['interval'] / 1000.0) { connect }
    end

  end
end

