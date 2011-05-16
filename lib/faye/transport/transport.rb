require 'json'
require 'uri'

module Faye
  class Transport
    
    include Logging
    include Timeouts
    
    def initialize(client, endpoint)
      debug('Created new ? transport for ?', connection_type, endpoint)
      @client   = client
      @endpoint = endpoint
      @outbox   = []
    end

    def batching?
      true
    end
    
    def connection_type
      self.class.connection_type
    end
    
    def send(message, timeout)
      debug('Client ? sending message to ?: ?', @client.client_id, @endpoint, message)

      return request([message], timeout) unless batching?

      @outbox << message
      @timeout = timeout

      return flush if message['channel'] == Channel::HANDSHAKE

      if message['channel'] == Channel::CONNECT
        @connection_message = message
      end

      add_timeout(:publish, Engine::MAX_DELAY) { flush }
    end

    def flush
      remove_timeout(:publish)

      if @outbox.size > 1 and @connection_message
        @connection_message['advice'] = {'timeout' => 0}
      end

      request(@outbox, @timeout)

      @connection_message = nil
      @outbox = []
    end
    
    def receive(responses)
      debug('Client ? received from ?: ?', @client.client_id, @endpoint, responses)
      responses.each { |response| @client.receive_message(response) }
    end
    
    def retry_block(message, timeout)
      lambda do
        EventMachine.add_timer(timeout) { request(message, 2 * timeout) }
      end
    end
    
    @transports = []
    
    class << self
      attr_accessor :connection_type
      
      def get(client, connection_types = nil)
        endpoint = client.endpoint
        connection_types ||= supported_connection_types
        
        candidate_class = @transports.find do |(type, klass)|
          connection_types.include?(type) and
          klass.usable?(endpoint)
        end
        
        unless candidate_class
          raise "Could not find a usable connection type for #{ endpoint }"
        end
        
        candidate_class.last.new(client, endpoint)
      end
      
      def register(type, klass)
        @transports << [type, klass]
        klass.connection_type = type
      end
      
      def supported_connection_types
        @transports.map { |t| t.first }
      end
    end
    
  end
end

