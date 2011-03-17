require 'em-hiredis'

module Faye
  module Engine
    
    class Redis < Base
      def init
        return if @redis
        
        @redis      = EM::Hiredis::Client.connect
        @subscriber = EM::Hiredis::Client.connect
        
        @subscriber.subscribe('/messages')
        @subscriber.on(:message, &method(:on_message))
      end
      
      def disconnect
        @subscriber.unsubscribe('/messages')
      end
      
      def create_client(&callback)
        init
        client_id = Faye.random
        @redis.sadd('/clients', client_id) do |added|
          if added == 0
            create_client(&callback)
          else
            ping(client_id)
            callback.call(client_id)
          end
        end
      end
      
      def destroy_client(client_id, &callback)
        init
        @redis.srem('/clients', client_id)
        @redis.smembers("/clients/#{client_id}") do |channels|
          channels.each { |channel| unsubscribe(client_id, channel) }
          callback.call if callback
        end
        publish_event(:disconnect, client_id) # TODO distribute this through Redis
      end
      
      def client_exists(client_id, &callback)
        init
        @redis.sismember('/clients', client_id) do |exists|
          callback.call(exists != 0)
        end
      end
      
      def ping(client_id)
        # TODO
      end
      
      def subscribe(client_id, channel, &callback)
        init
        @redis.sadd("/clients/#{client_id}", channel)
        @redis.sadd("/channels#{channel}", client_id, &callback)
      end
      
      def unsubscribe(client_id, channel, &callback)
        init
        @redis.srem("/clients/#{client_id}", channel)
        @redis.srem("/channels#{channel}", client_id, &callback)
      end
      
      def publish(message)
        init
        @redis.publish('/messages', JSON.dump(message))
      end
      
      def on_message(key, message)
        message = JSON.parse(message)
        channels = Channel.expand(message['channel'])
        channels.each do |channel|
          @redis.smembers("/channels#{channel}") do |clients|
            announce(clients, message)
          end
        end
      end
    end
    
    register :redis, Redis
    
  end
end
