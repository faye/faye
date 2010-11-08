module Faye
  module Engine
    
    class Memory < Base
      def initialize(options = {})
        @options   = options
        @clients   = {}
        @channels  = Channel::Tree.new
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
        channel = @channels[channel_name] ||= Channel.new(channel_name)
        channel.add_subscriber(:message, lambda { |message|
          announce(client_id, message)
        })
        @clients[client_id].add(channel_name)
      end
      
      def unsubscribe(client_id, channel_name)
        # TODO
      end
      
      def distribute(message)
        return if message['error']
        @channels.glob(message['channel']).each { |c| c << message }
      end
      
      def disconnect(client_id)
        # TODO
      end
    end
   
  end
end

