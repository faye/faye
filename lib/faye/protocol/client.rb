module Faye
  class Client
    
    include EventMachine::Deferrable
    include Timeouts
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
    
    attr_reader :endpoint, :client_id
    
    def initialize(endpoint = nil, options = {})
      info('New client created for ?', endpoint)
      
      @endpoint  = endpoint || RackAdapter::DEFAULT_ENDPOINT
      @options   = options
      
      @transport = Transport.get(self, MANDATORY_CONNECTION_TYPES)
      @state     = UNCONNECTED
      @outbox    = []
      @channels  = Channel::Tree.new
      
      @namespace = Namespace.new
      @response_callbacks = {}
      
      @advice = {
        'reconnect' => RETRY,
        'interval'  => 1000.0 * (@options[:interval] || Connection::INTERVAL),
        'timeout'   => 1000.0 * (@options[:timeout] || CONNECTION_TIMEOUT)
      }
    end
    
    def get_timeout
      @advice['timeout'] / 1000.0
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
      
      send({
        'channel'     => Channel::HANDSHAKE,
        'version'     => BAYEUX_VERSION,
        'supportedConnectionTypes' => [@transport.connection_type]
        
      }) do |response|
        
        if response['successful']
          @state     = CONNECTED
          @client_id = response['clientId']
          @transport = Transport.get(self, response['supportedConnectionTypes'])
          
          info('Handshake successful: ?', @client_id)
          
          subscribe(@channels.keys)
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
      })
      
      info('Clearing channel listeners for ?', @client_id)
      @channels = Channel::Tree.new
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
    def subscribe(channels, &block)
      if Array === channels
        return channels.each do |channel|
          subscribe(channel, &block)
        end
      end
      
      validate_channel(channels)
      
      connect {
        info('Client ? attempting to subscribe to ?', @client_id, channels)
        
        send({
          'channel'       => Channel::SUBSCRIBE,
          'clientId'      => @client_id,
          'subscription'  => channels
          
        }) do |response|
          if response['successful']
            
            channels = [response['subscription']].flatten
            info('Subscription acknowledged for ? to ?', @client_id, channels)
            @channels.subscribe(channels, block)
          end
        end
      }
      Subscription.new(self, channels, block)
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
    def unsubscribe(channels, &block)
      if Array === channels
        return channels.each do |channel|
          unsubscribe(channel, &block)
        end
      end
      
      validate_channel(channels)
      
      dead = @channels.unsubscribe(channels, block)
      return unless dead
      
      connect {
        info('Client ? attempting to unsubscribe from ?', @client_id, channels)
        
        send({
          'channel'       => Channel::UNSUBSCRIBE,
          'clientId'      => @client_id,
          'subscription'  => channels
          
        }) do |response|
          if response['successful']
            
            channels = [response['subscription']].flatten
            info('Unsubscription acknowledged for ? from ?', @client_id, channels)
          end
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
      validate_channel(channel)
      
      connect {
        info('Client ? queueing published message to ?: ?', @client_id, channel, data)
        
        send({
          'channel'   => channel,
          'data'      => data,
          'clientId'  => @client_id
        })
      }
    end
    
    def receive_message(message)
      pipe_through_extensions(:incoming, message) do |message|
        if message
          handle_advice(message['advice']) if message['advice']
          
          callback = @response_callbacks[message['id']]
          if callback
            @response_callbacks.delete(message['id'])
            callback.call(message)
          end
          
          deliver_message(message)
        end
      end
    end
    
  private
    
    def handle_advice(advice)
      @advice.update(advice)
      
      if @advice['reconnect'] == HANDSHAKE and @state != DISCONNECTED
        @state     = UNCONNECTED
        @client_id = nil
        cycle_connection
      end
    end
    
    def deliver_message(message)
      return unless message['channel'] and message['data']
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
    
    def send(message, &callback)
      message['id'] = @namespace.generate
      @response_callbacks[message['id']] = callback if callback
      
      pipe_through_extensions(:outgoing, message) do |message|
        if message
          if message['channel'] == Channel::HANDSHAKE
            @transport.send(message)
          else
            @outbox << message
            
            if message['channel'] == Channel::CONNECT
              @connect_message = message
            end
            
            add_timeout(:publish, Connection::MAX_DELAY) { flush! }
          end
        end
      end
    end
    
    def flush!
      remove_timeout(:publish)
      
      if @outbox.size > 1 and @connect_message
        @connect_message['advice'] = {'timeout' => 0}
      end
      
      @connect_message = nil
      
      @transport.send(@outbox)
      @outbox = []
    end
    
    def validate_channel(channel)
      raise "'#{ channel }' is not a valid channel name" unless Channel.valid?(channel)
      raise "Clients may not subscribe to channel '#{ channel }'" unless Channel.subscribable?(channel)
    end
    
  end
end

