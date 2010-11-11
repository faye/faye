module Faye
  module Engine
    
    class Memory < Base
      def initialize(options = {})
        @clients   = {}
        @channels  = {}
        @namespace = Namespace.new
        super
      end
      
      def create_client_id(&callback)
        client_id = @namespace.generate
        @clients[client_id] = Set.new
        ping(client_id)
        callback.call(client_id)
      end
      
      def client_exists?(client_id, &callback)
        callback.call(@clients.has_key?(client_id))
      end
      
      def ping(client_id)
        return unless Numeric === timeout
        remove_timeout(client_id)
        add_timeout(client_id, 2*timeout) { disconnect(client_id) }
      end
      
      def subscribe(client_id, channel)
        @clients[client_id] ||= Set.new
        @channels[channel] ||= Set.new
        @clients[client_id].add(channel)
        @channels[channel].add(client_id)
      end
      
      def unsubscribe(client_id, channel)
        @clients[client_id].delete(channel) if @clients.has_key?(client_id)
        @channels[channel].delete(client_id) if @channels.has_key?(channel)
      end
      
      def distribute(message)
        return if message['error']
        Channel.expand(message['channel']).each do |channel|
          next unless clients = @channels[channel]
          clients.each { |client_id| announce(client_id, message) }
        end
      end
      
      def disconnect(client_id)
        return unless @clients.has_key?(client_id)
        @clients[client_id].each { |channel| unsubscribe(client_id, channel) }
        @clients.delete(client_id)
      end
    end
   
  end
end

