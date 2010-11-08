module Faye
  module Engine
    
    class Memory < Base
      def initialize(options = {})
        @options   = options
        @clients   = {}
        @channels  = {}
        @namespace = Namespace.new
      end
      
      def create_client_id(&callback)
        id = @namespace.generate
        @clients[id] = Set.new
        callback.call(id)
      end
      
      def client_exists?(client_id, &callback)
        callback.call(@clients.has_key?(client_id))
      end
      
      def ping(client_id)
      end
      
      def subscribe(client_id, channel_name)
        @clients[client_id] ||= Set.new
        @channels[channel_name] ||= Set.new
        @clients[client_id].add(channel_name)
        @channels[channel_name].add(client_id)
      end
      
      def unsubscribe(client_id, channel_name)
        @clients[client_id].delete(channel_name) if @clients.has_key?(client_id)
        @channels[channel_name].delete(client_id) if @channels.has_key?(channel_name)
      end
      
      def distribute(message)
        return if message['error']
        Channel.expand(message['channel']).each do |channel_name|
          next unless clients = @channels[channel_name]
          clients.each { |client_id| announce(client_id, message) }
        end
      end
      
      def disconnect(client_id)
        # TODO
      end
    end
   
  end
end

