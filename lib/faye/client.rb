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
    
    attr_reader :endpoint, :client_id, :namespace
    
    def initialize(endpoint = nil, options = {})
      info('New client created for ?', endpoint)
      
      @endpoint  = endpoint || RackAdapter::DEFAULT_ENDPOINT
      @options   = options
      @timeout   = @options[:timeout] || CONNECTION_TIMEOUT
      
      @transport = Transport.get(self)
      @state     = UNCONNECTED
      @namespace = Namespace.new
      @outbox    = []
      @channels  = Channel::Tree.new
      
      @advice = {'reconnect' => RETRY, 'interval' => Connection::INTERVAL}
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
        'supportedConnectionTypes' => Transport.supported_connection_types
        
      }) do |response|
        
        if response['successful']
          @state     = CONNECTED
          @client_id = response['clientId']
          @transport = Transport.get(self, response['supportedConnectionTypes'])
          
          info('Handshake successful: ?', @client_id)
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
      
      if @advice['reconnect'] == HANDSHAKE or @state == UNCONNECTED
        begin_reconnect_timeout
        return handshake { connect(&block) }
      end
      
      return callback(&block) if @state == CONNECTING
      return unless @state == CONNECTED
      
      info('Calling deferred actions for ?', @client_id)
      set_deferred_status(:succeeded)
      set_deferred_status(:deferred)
      block.call if block_given?
      
      return unless @connection_id.nil?
      @connection_id = @namespace.generate
      info('Initiating connection for ?', @client_id)
      
      send({
        'channel'         => Channel::CONNECT,
        'clientId'        => @client_id,
        'connectionType'  => @transport.connection_type,
        'id'              => @connection_id
        
      }, &verify_client_id { |response|
        @connection_id = nil
        remove_timeout(:reconnect)
        
        info('Closed connection for ?', @client_id)
        EventMachine.add_timer(@advice['interval'] / 1000.0) { connect }
      })
      
      begin_reconnect_timeout
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
      remove_timeout(:reconnect)
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
      connect {
        channels = [channels].flatten
        validate_channels(channels)
        
        info('Client ? attempting to subscribe to ?', @client_id, channels)
        
        send({
          'channel'       => Channel::SUBSCRIBE,
          'clientId'      => @client_id,
          'subscription'  => channels
          
        }, &verify_client_id { |response|
          if response['successful'] and block
            
            info('Subscription acknowledged for ? to ?', @client_id, channels)
            
            channels = [response['subscription']].flatten
            channels.each { |channel| @channels[channel] = block }
          end
        })
      }
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
      connect {
        channels = [channels].flatten
        validate_channels(channels)
        
        info('Client ? attempting to unsubscribe from ?', @client_id, channels)
        
        send({
          'channel'       => Channel::UNSUBSCRIBE,
          'clientId'      => @client_id,
          'subscription'  => channels
          
        }, &verify_client_id { |response|
          if response['successful']
            
            info('Unsubscription acknowledged for ? from ?', @client_id, channels)
            
            channels = [response['subscription']].flatten
            channels.each { |channel| @channels[channel] = nil }
          end
        })
      }
    end
    
    # Request                              Response
    # MUST include:  * channel             MUST include:  * channel
    #                * data                               * successful
    # MAY include:   * clientId            MAY include:   * id
    #                * id                                 * error
    #                * ext                                * ext
    def publish(channel, data)
      connect {
        validate_channels([channel])
        
        info('Client ? queueing published message to ?: ?', @client_id, channel, data)
        
        enqueue({
          'channel'   => channel,
          'data'      => data,
          'clientId'  => @client_id
          
        }) do
          add_timeout(:publish, Connection::MAX_DELAY) { flush! }
        end
      }
    end
    
    def handle_advice(advice)
      @advice.update(advice)
      @client_id = nil if @advice['reconnect'] == HANDSHAKE
    end
    
    def deliver_messages(messages)
      messages.each do |message|
        pipe_through_extensions(:incoming, message) do |message|
          if message
            info('Client ? calling listeners for ? with ?', @client_id, message['channel'], message['data'])
            
            channels = @channels.glob(message['channel'])
            channels.each { |callback| callback.call(message['data']) }
          end
        end
      end
    end
    
  private
    
    def begin_reconnect_timeout
      add_timeout(:reconnect, @timeout) do
        @connection_id = nil
        @client_id = nil
        @state = UNCONNECTED
        
        info('Server took >?s to reply to connection for ?: attempting to reconnect',
             @timeout, @client_id)
        
        subscribe(@channels.keys)
      end
    end
    
    def send(message, &callback)
      pipe_through_extensions(:outgoing, message) do |message|
        if message
          @transport.send(message, &callback)
        end
      end
    end
    
    def enqueue(message, &callback)
      pipe_through_extensions(:outgoing, message) do |message|
        if message
          @outbox << message
          callback.call()
        end
      end
    end
    
    def flush!
      @transport.send(@outbox)
      @outbox = []
    end
    
    def validate_channels(channels)
      channels.each do |channel|
        raise "'#{ channel }' is not a valid channel name" unless Channel.valid?(channel)
        raise "Clients may not subscribe to channel '#{ channel }'" unless Channel.subscribable?(channel)
      end
    end
    
    def verify_client_id(&block)
      lambda do |response|
        if response['clientId'] != @client_id
          false
        else
          block.call(response)
          true
        end
      end
    end
    
  end
end

