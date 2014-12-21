module Faye
  class Client

    include Deferrable
    include Publisher
    include Logging
    include Extensible

    UNCONNECTED        = 1
    CONNECTING         = 2
    CONNECTED          = 3
    DISCONNECTED       = 4

    HANDSHAKE          = 'handshake'
    RETRY              = 'retry'
    NONE               = 'none'

    CONNECTION_TIMEOUT = 60.0

    extend Forwardable
    def_delegators :@dispatcher, :add_websocket_extension, :disable, :set_header

    def initialize(endpoint = nil, options = {})
      ::WebSocket::Driver.validate_options(options, [:interval, :timeout, :endpoints, :proxy, :retry, :scheduler, :websocket_extensions])
      super()
      info('New client created for ?', endpoint)

      @endpoint   = endpoint || RackAdapter::DEFAULT_ENDPOINT
      @channels   = Channel::Set.new
      @dispatcher = Dispatcher.new(self, @endpoint, options)

      @message_id = 0
      @state      = UNCONNECTED

      @response_callbacks = {}

      @advice = {
        'reconnect' => RETRY,
        'interval'  => 1000.0 * (options[:interval] || Engine::INTERVAL),
        'timeout'   => 1000.0 * (options[:timeout]  || CONNECTION_TIMEOUT)
      }
      @dispatcher.timeout = @advice['timeout'] / 1000.0

      @dispatcher.bind(:message, &method(:receive_message))
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
      @dispatcher.select_transport(MANDATORY_CONNECTION_TYPES)

      send_message({
        'channel'                  => Channel::HANDSHAKE,
        'version'                  => BAYEUX_VERSION,
        'supportedConnectionTypes' => @dispatcher.connection_types

      }, {}) do |response|

        if response['successful']
          @state = CONNECTED
          @dispatcher.client_id = response['clientId']

          @dispatcher.select_transport(response['supportedConnectionTypes'])

          info('Handshake successful: ?', @dispatcher.client_id)

          subscribe(@channels.keys, true)
          block.call if block_given?

        else
          info('Handshake unsuccessful')
          EventMachine.add_timer(@dispatcher.retry) { handshake(&block) }
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

      info('Calling deferred actions for ?', @dispatcher.client_id)
      set_deferred_status(:succeeded)
      set_deferred_status(:unknown)

      return unless @connect_request.nil?
      @connect_request = true

      info('Initiating connection for ?', @dispatcher.client_id)

      send_message({
        'channel'        => Channel::CONNECT,
        'clientId'       => @dispatcher.client_id,
        'connectionType' => @dispatcher.connection_type

      }, {}) do
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

      info('Disconnecting ?', @dispatcher.client_id)
      promise = Publication.new

      send_message({
        'channel'  => Channel::DISCONNECT,
        'clientId' => @dispatcher.client_id

      }, {}) do |response|
        if response['successful']
          @dispatcher.close
          promise.set_deferred_status(:succeeded)
        else
          promise.set_deferred_status(:failed, Error.parse(response['error']))
        end
      end

      info('Clearing channel listeners for ?', @dispatcher.client_id)
      @channels = Channel::Set.new

      promise
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
        info('Client ? attempting to subscribe to ?', @dispatcher.client_id, channel)
        @channels.subscribe([channel], block) unless force

        send_message({
          'channel'      => Channel::SUBSCRIBE,
          'clientId'     => @dispatcher.client_id,
          'subscription' => channel

        }, {}) do |response|
          unless response['successful']
            subscription.set_deferred_status(:failed, Error.parse(response['error']))
            next @channels.unsubscribe(channel, block)
          end

          channels = [response['subscription']].flatten
          info('Subscription acknowledged for ? to ?', @dispatcher.client_id, channels)
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
        info('Client ? attempting to unsubscribe from ?', @dispatcher.client_id, channel)

        send_message({
          'channel'      => Channel::UNSUBSCRIBE,
          'clientId'     => @dispatcher.client_id,
          'subscription' => channel

        }, {}) do |response|
          next unless response['successful']

          channels = [response['subscription']].flatten
          info('Unsubscription acknowledged for ? from ?', @dispatcher.client_id, channels)
        end
      }
    end

    # Request                              Response
    # MUST include:  * channel             MUST include:  * channel
    #                * data                               * successful
    # MAY include:   * clientId            MAY include:   * id
    #                * id                                 * error
    #                * ext                                * ext
    def publish(channel, data, options = {})
      ::WebSocket::Driver.validate_options(options, [:attempts, :deadline])

      publication = Publication.new
      connect {
        info('Client ? queueing published message to ?: ?', @dispatcher.client_id, channel, data)

        send_message({
          'channel'  => channel,
          'data'     => data,
          'clientId' => @dispatcher.client_id

        }, options) do |response|
          if response['successful']
            publication.set_deferred_status(:succeeded)
          else
            publication.set_deferred_status(:failed, Error.parse(response['error']))
          end
        end
      }
      publication
    end

  private

    def send_message(message, options, &callback)
      message['id'] = generate_message_id

      timeout = [nil, 0].include?(@advice['timeout']) ?
                1.2 * @dispatcher.retry :
                1.2 * @advice['timeout'] / 1000.0

      pipe_through_extensions(:outgoing, message, nil) do |message|
        next unless message
        @response_callbacks[message['id']] = callback if callback
        @dispatcher.send_message(message, timeout, options)
      end
    end

    def generate_message_id
      @message_id += 1
      @message_id = 0 if @message_id >= 2**32
      @message_id.to_s(36)
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
    end

    def handle_advice(advice)
      @advice.update(advice)
      @dispatcher.timeout = @advice['timeout'] / 1000.0

      if @advice['reconnect'] == HANDSHAKE and @state != DISCONNECTED
        @state = UNCONNECTED
        @dispatcher.client_id = nil
        cycle_connection
      end
    end

    def deliver_message(message)
      return unless message.has_key?('channel') and message.has_key?('data')
      info('Client ? calling listeners for ? with ?', @dispatcher.client_id, message['channel'], message['data'])
      @channels.distribute_message(message)
    end

    def cycle_connection
      if @connect_request
        @connect_request = nil
        info('Closed connection for ?', @dispatcher.client_id)
      end
      EventMachine.add_timer(@advice['interval'] / 1000.0) { connect }
    end

  end
end
