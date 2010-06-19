require 'em-http'
require 'json'
require 'uri'

module Faye
  class Transport
    
    include Logging
    
    def initialize(client, endpoint)
      debug('Created new ? transport for ?', connection_type, endpoint)
      @client    = client
      @endpoint  = endpoint
      @namespace = Namespace.new
    end
    
    def connection_type
      self.class.connection_type
    end
    
    def send(message, &block)
      if message.is_a?(Hash) and not message.has_key?('id')
        message['id'] = @namespace.generate
      end
      
      debug('Client ? sending message to ?: ?', @client.client_id, @endpoint, message)
      
      request(message) { |responses|
        debug('Client ? received from ?: ?', @client.client_id, @endpoint, responses)
        
        if block_given?
          responses   = [responses].flatten
          messages    = []
          deliverable = true
          processed   = 0
          
          ping = lambda do
            processed += 1
            if processed == responses.size
              @client.deliver_messages(messages) if deliverable
            end
          end
          
          handle_response = lambda do |response|
            @client.pipe_through_extensions(:incoming, response) do |response|
              if response
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
              
              ping.call()
            end
          end
          
          responses.each(&handle_response)
        end
      }
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
  
  class HttpTransport < Transport
    def self.usable?(endpoint)
      endpoint.is_a?(String)
    end
    
    def request(message, &block)
      content = JSON.unparse(message)
      params = {
        :head => {
          'Content-Type'    => 'application/json',
          'host'            => URI.parse(@endpoint).host,
          'Content-Length'  => content.length
        },
        :body    => content,
        :timeout => -1
      }
      request = EventMachine::HttpRequest.new(@endpoint).post(params)
      request.callback do
        block.call(JSON.parse(request.response))
      end
      
      request
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
      
      true
    end
  end
  Transport.register 'in-process', LocalTransport
  
end

