module Faye
  class Transport
    
    include Logging
    include Publisher
    include Timeouts
    
    attr_accessor :cookies, :headers
    
    def initialize(client, endpoint)
      debug('Created new ? transport for ?', connection_type, endpoint)
      @client   = client
      @endpoint = endpoint
      @outbox   = []
    end

    def batching?
      true
    end
    
    def close
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
        EventMachine.add_timer(@client.retry) { request(message, timeout) }
      end
    end
    
    @transports = []
    
    class << self
      attr_accessor :connection_type
      
      def get(client, connection_types = nil, &callback)
        endpoint = client.endpoint
        connection_types ||= supported_connection_types
        
        select = lambda do |(conn_type, klass), resume|
          conn_endpoint = client.endpoints[conn_type] || endpoint
          if connection_types.include?(conn_type)
            klass.usable?(conn_endpoint) do |is_usable|
              if is_usable
                callback.call(klass.new(client, conn_endpoint))
              else
                resume.call
              end
            end
          else
            resume.call
          end
        end
        
        error = lambda do
          raise "Could not find a usable connection type for #{ endpoint }"
        end
        
        Faye.async_each(@transports, select, error)
      end
      
      def register(type, klass)
        @transports << [type, klass]
        klass.connection_type = type
      end
      
      def supported_connection_types
        @transports.map { |t| t.first }
      end
    end
    
    %w[local web_socket http].each do |type|
      require File.join(ROOT, 'faye', 'transport', type)
    end
    
  end
end

