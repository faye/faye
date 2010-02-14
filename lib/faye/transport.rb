module Faye
  
  class Transport
    def initialize(client, endpoint)
      @client   = client
      @endpoint = endpoint
    end
    
    def connection_type
      self.class.connection_type
    end
    
    def send(message, &block)
      if message.is_a?(Hash) and not message.has_key?('id')
        message['id'] = @client.namespace.generate
      end
      
      request(message) { |responses|
        if block_given?
          [responses].flatten.each do |response|
            
            if message.is_a?(Hash) and response['id'] == message['id']
              block.call(response) 
            end
            
            if response['advice']
              @client.handle_advice(response['advice'])
            end
            
            if response['data'] and response['channel']
              @client.send_to_subscribers(response)
            end
            
          end
        end
      }
    end
    
    @transports = {}
    
    class << self
      attr_accessor :connection_type
      def get(client, connection_types = [])
        LocalTransport.new(client, client.endpoint)
      end
      
      def register(type, klass)
        @transports[type] = klass
        klass.connection_type = type
      end
      
      def supported_connection_types
        @transports.keys
      end
    end
  end
  
  class LocalTransport < Transport
    def self.usable?(endpoint)
      endpoint.is_a?(Server)
    end
    
    def request(message, &block)
      @endpoint.process(message, true) do |response|
        block.call(response)
      end
    end
  end
  Transport.register 'long-polling', LocalTransport
  
end

