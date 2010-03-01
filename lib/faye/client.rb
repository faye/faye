module Faye
  class Client
    include EventMachine::Deferrable
    
    extend  Forwardable
    def_delegators :EventMachine, :add_timer, :cancel_timer
    
    UNCONNECTED    = 1
    CONNECTING     = 2
    CONNECTED      = 3
    DISCONNECTED   = 4
    
    HANDSHAKE      = 'handshake'
    RETRY          = 'retry'
    NONE           = 'none'
    
    attr_reader :endpoint, :namespace
    
    def initialize(endpoint = nil)
      @endpoint = endpoint || RackAdapter::DEFAULT_ENDPOINT
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
      
      @transport.send({
        'channel'     => Channel::HANDSHAKE,
        'version'     => BAYEUX_VERSION,
        'supportedConnectionTypes' => Transport.supported_connection_types
        
      }) do |response|
        
        unless response['successful']
          add_timer(@advice['interval'] / 1000.0) { handshake(&block) }
          return @state = UNCONNECTED
        end
        
        @state     = CONNECTED
        @client_id = response['clientId']
        @transport = Transport.get(self, response['supportedConnectionTypes'])
        
        block.call if block_given?
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
        return handshake { connect(&block) }
      end
      
      return callback(&block) if @state == CONNECTING
      return unless @state == CONNECTED
      
      set_deferred_status(:succeeded)
      set_deferred_status(:deferred)
      block.call if block_given?
      
      return unless @connection_id.nil?
      @connection_id = @namespace.generate
      
      @transport.send({
        'channel'         => Channel::CONNECT,
        'clientId'        => @client_id,
        'connectionType'  => @transport.connection_type,
        'id'              => @connection_id
        
      }) do |response|
        @connection_id = nil
        add_timer(@advice['interval'] / 1000.0) { connect }
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
      @state = DISCONNECT
      
      @transport.send({
        'channel'   => Channel::DISCONNECT,
        'clientId'  => @client_id
      })
      
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
      connect {
        channels = [channels].flatten
        validate_channels(channels)
        
        @transport.send({
          'channel'       => Channel::SUBSCRIBE,
          'clientId'      => @client_id,
          'subscription'  => channels
          
        }) do |response|
          if response['successful']
            channels = [response['subscription']].flatten
            channels.each { |channel| @channels[channel] = block }
          end
        end
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
        
        @transport.send({
          'channel'       => Channel::UNSUBSCRIBE,
          'clientId'      => @client_id,
          'subscription'  => channels
          
        }) do |response|
          if response['successful']
            channels = [response['subscription']].flatten
            channels.each { |channel| @channels[channel] = nil }
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
      connect {
        validate_channels([channel])
        
        enqueue({
          'channel'   => channel,
          'data'      => data,
          'clientId'  => @client_id
        })
        
        return if @timeout
        
        @timeout = add_timer(Connection::MAX_DELAY) do
          @timeout = nil
          flush!
        end
      }
    end
    
    def handle_advice(advice)
      @advice.update(advice)
      @client_id = nil if @advice['reconnect'] == HANDSHAKE
    end
    
    def send_to_subscribers(message)
      channels = @channels.glob(message['channel'])
      channels.each { |callback| callback.call(message['data']) }
    end
    
  private
    
    def enqueue(message)
      @outbox << message
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
    
  end
end

