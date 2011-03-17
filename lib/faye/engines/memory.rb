module Faye
  module Engine
    
    class Memory < Base
      def initialize(options)
        @clients   = {}
        @channels  = {}
        @namespace = Namespace.new
        super
      end
      
      def create_client(&callback)
        client_id = @namespace.generate
        @clients[client_id] = Set.new
        ping(client_id)
        callback.call(client_id)
      end
      
      def destroy_client(client_id, &callback)
        return unless @clients.has_key?(client_id)
        @clients[client_id].each do |channel|
          unsubscribe(client_id, channel)
        end
        remove_timeout(client_id)
        @clients.delete(client_id)
        publish_event(:disconnect, client_id)
        callback.call if callback
      end
      
      def client_exists(client_id, &callback)
        callback.call(@clients.has_key?(client_id))
      end
      
      def ping(client_id)
        timeout = @options[:timeout]
        return unless Numeric === timeout
        remove_timeout(client_id)
        add_timeout(client_id, 2 * timeout) { destroy_client(client_id) }
      end
      
      def subscribe(client_id, channel, &callback)
        @clients[client_id] ||= Set.new
        @channels[channel]  ||= Set.new
        @clients[client_id].add(channel)
        @channels[channel].add(client_id)
        callback.call(true) if callback
      end
      
      def unsubscribe(client_id, channel, &callback)
        @clients[client_id].delete(channel) if @clients.has_key?(client_id)
        @channels[channel].delete(client_id) if @channels.has_key?(channel)
        callback.call(true) if callback
      end
      
      def publish(message)
        channels = Channel.expand(message['channel'])
        channels.each do |channel|
          next unless clients = @channels[channel]
          announce(clients, message)
        end
      end
    end
    
    register :memory, Memory
    
  end
end

