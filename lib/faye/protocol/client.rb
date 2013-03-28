module Faye
  class Client

    include EventMachine::Deferrable
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

    attr_reader :client_id, :endpoint, :endpoints, :retry, :transports

    def initialize(endpoint = nil, options = {})
      info('New client created for ?', endpoint)

      @options    = options
      @endpoint   = endpoint || RackAdapter::DEFAULT_ENDPOINT
      @endpoints  = @options[:endpoints] || {}
      @transports = {}
      @cookies    = CookieJar::Jar.new
      @headers    = {}
      @disabled   = []
      @retry      = @options[:retry] || DEFAULT_RETRY

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

    def batch_limit=(limit)
      @batch_limit = limit
    end

    def state
      case @state
      when UNCONNECTED  then :UNCONNECTED
      when CONNECTING   then :CONNECTING
      when CONNECTED    then :CONNECTED
      when DISCONNECTED then :DISCONNECTED
      end
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
        'channel'     => Channel::HANDSHAKE,
        'version'     => BAYEUX_VERSION,
        'supportedConnectionTypes' => [@transport.connection_type]

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
      set_deferred_status(:deferred)

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
      pipe_through_extensions(:incoming, message) do |message|
        next unless message

        handle_advice(message['advice']) if message['advice']
        deliver_message(message)

        next unless message.has_key?('successful')

        callback = @response_callbacks[message['id']]
        next unless callback

        @response_callbacks.delete(message['id'])
        callback.call(message)
      end
    end

  private

    def select_transport(transport_types)
      Transport.get(self, transport_types, @disabled) do |transport|
        debug('Selected ? transport for ?', transport.connection_type, transport.endpoint)

        @transport = transport
        @transport.cookies = @cookies
        @transport.headers = @headers
        @transport.batch_limit = @batch_limit unless @batch_limit.nil?

        transport.bind :down do
          if @transport_up.nil? or @transport_up
            @transport_up = false
            trigger('transport:down')
          end
        end

        transport.bind :up do
          if @transport_up.nil? or not @transport_up
            @transport_up = true
            trigger('transport:up')
          end
        end
      end
    end

    def send(message, &callback)
      message['id'] = generate_message_id
      @response_callbacks[message['id']] = callback if callback

      pipe_through_extensions(:outgoing, message) do |message|
        @transport.send(message, @advice['timeout'] / 1000.0) if message
      end
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

    def teardown_connection
      return unless @connect_request
      @connect_request = nil
      info('Closed connection for ?', @client_id)
    end

    def cycle_connection
      teardown_connection
      EventMachine.add_timer(@advice['interval'] / 1000.0) { connect }
    end

  end
end

