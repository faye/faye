module Faye
  module Engine
    
    class Redis < Base
      DEFAULT_HOST = 'localhost'
      DEFAULT_PORT = 6379
      
      def init
        return if @redis
        require 'em-hiredis'
        
        host = @options[:host] || DEFAULT_HOST
        port = @options[:port] || DEFAULT_PORT
        auth = @options[:auth] ? "#{@options[:auth]}@" : ''
        url = "redis://#{auth}#{host}:#{port}"
        
        @redis      = EventMachine::Hiredis.connect(ENV['REDIS_URL'] || url)
        @subscriber = EventMachine::Hiredis.connect(ENV['REDIS_URL'] || url)
        
        @subscriber.subscribe('/notifications')
        @subscriber.on(:message) do |topic, message|
          empty_queue(message) if topic == '/notifications'
        end
      end
      
      def disconnect
        @subscriber.unsubscribe('/notifications')
      end
      
      def create_client(&callback)
        init
        client_id = Faye.random
        @redis.sadd('/clients', client_id) do |added|
          if added == 0
            create_client(&callback)
          else
            debug 'Created new client ?', client_id
            ping(client_id)
            callback.call(client_id)
          end
        end
      end
      
      def destroy_client(client_id, &callback)
        init
        @redis.srem('/clients', client_id)
        @redis.del("/clients/#{client_id}/messages")
        
        remove_timeout(client_id)
        @redis.del("/clients/#{client_id}/ping")
        
        @redis.smembers("/clients/#{client_id}/channels") do |channels|
          n, i = channels.size, 0
          if n == 0
            debug 'Destroyed client ?', client_id
            callback.call if callback
          else
            channels.each do |channel|
              unsubscribe(client_id, channel) do
                i += 1
                if i == n
                  debug 'Destroyed client ?', client_id
                  callback.call if callback
                end
              end
            end
          end
        end
      end
      
      def client_exists(client_id, &callback)
        init
        @redis.sismember('/clients', client_id) do |exists|
          callback.call(exists != 0)
        end
      end
      
      def ping(client_id)
        timeout = @options[:timeout]
        time    = Time.now.to_i.to_s
        
        return unless Numeric === timeout
        
        debug 'Ping ?, ?', client_id, timeout
        remove_timeout(client_id)
        @redis.set("/clients/#{client_id}/ping", time)
        add_timeout(client_id, 2 * timeout) do
          @redis.get("/clients/#{client_id}/ping") do |ping|
            destroy_client(client_id) if ping == time
          end
        end
      end
      
      def subscribe(client_id, channel, &callback)
        init
        @redis.sadd("/clients/#{client_id}/channels", channel)
        @redis.sadd("/channels#{channel}", client_id) do
          debug 'Subscribed client ? to channel ?', client_id, channel
          callback.call if callback
        end
      end
      
      def unsubscribe(client_id, channel, &callback)
        init
        @redis.srem("/clients/#{client_id}/channels", channel)
        @redis.srem("/channels#{channel}", client_id) do
          debug 'Unsubscribed client ? from channel ?', client_id, channel
          callback.call if callback
        end
      end
      
      def publish(message)
        init
        debug 'Publishing message ?', message
        json_message = JSON.dump(message)
        channels = Channel.expand(message['channel'])
        channels.each do |channel|
          @redis.smembers("/channels#{channel}") do |clients|
            clients.each do |client_id|
              debug 'Queueing for client ?: ?', client_id, message
              @redis.sadd("/clients/#{client_id}/messages", json_message)
              @redis.publish('/notifications', client_id)
            end
          end
        end
      end
      
    private
      
      def empty_queue(client_id)
        return unless conn = connection(client_id, false)
        init
        
        key = "/clients/#{client_id}/messages"
        @redis.smembers(key) do |json_messages|
          json_messages.each do |json_message|
            @redis.srem(key, json_message)
            conn.deliver(JSON.parse(json_message))
          end
        end
      end
    end
    
    register 'redis', Redis
    
  end
end
