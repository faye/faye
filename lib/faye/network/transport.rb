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
    end
    
    def connection_type
      self.class.connection_type
    end
    
    def send(messages, timeout)
      messages = [messages].flatten
      debug('Client ? sending message to ?: ?', @client.client_id, @endpoint, messages)
      request(messages, timeout)
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
  
  class HttpTransport < Transport
    def self.usable?(endpoint)
      endpoint.is_a?(String)
    end
    
    def request(message, timeout)
      retry_block = retry_block(message, timeout)
      
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
        begin
          receive(JSON.parse(request.response))
        rescue
          retry_block.call
        end
      end
      request.errback(&retry_block)
    end
  end
  Transport.register 'long-polling', HttpTransport
  
  class LocalTransport < Transport
    def self.usable?(endpoint)
      endpoint.is_a?(Server)
    end
    
    def request(message, timeout)
      @endpoint.process(message, true, &method(:receive))
    end
  end
  Transport.register 'in-process', LocalTransport
  
end

