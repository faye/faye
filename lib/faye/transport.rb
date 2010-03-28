require 'em-http'
require 'json'

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
          messages, deliverable = [], true
          [responses].flatten.each do |response|
            
            if message.is_a?(Hash) and response['id'] == message['id']
              deliverable = false if block.call(response) == false
            end
            
            if response['advice']
              @client.handle_advice(response['advice'])
            end
            
            if response['data'] and response['channel']
              messages << response
            end
            
          end
          
          @client.deliver_messages(messages) if deliverable
        end
      }
    end
    
    @transports = {}
    
    class << self
      attr_accessor :connection_type
      
      def get(client, connection_types = nil)
        endpoint = client.endpoint
        connection_types ||= supported_connection_types
        
        candidate_class = @transports.find do |type, klass|
          connection_types.include?(type) and
          klass.usable?(endpoint)
        end
        
        unless candidate_class
          raise "Could not find a usable connection type for #{ endpoint }"
        end
        
        candidate_class.last.new(client, endpoint)
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
  
  class HttpTransport < Transport
    def self.usable?(endpoint)
      endpoint.is_a?(String)
    end
    
    def request(message, &block)
      params  = {:message => JSON.unparse(message)}
      request = EventMachine::HttpRequest.new(@endpoint).post(:body => params, :timeout => -1)
      request.callback do
        block.call(JSON.parse(request.response))
      end
    end
  end
  Transport.register 'long-polling', HttpTransport
  
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
  Transport.register 'in-process', LocalTransport
  
end

