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
        db   = @options[:database] || 0
        auth = @options[:password]
        @ns  = @options[:namespace] || ''
        
        @redis      = EventMachine::Hiredis::Client.connect(host, port)
        @subscriber = EventMachine::Hiredis::Client.connect(host, port)
        
        if auth
          @redis.auth(auth)
          @subscriber.auth(auth)
        end
        @redis.select(db)
        @subscriber.select(db)
        
        @subscriber.subscribe(@ns + '/notifications')
        @subscriber.on(:message) do |topic, message|
          empty_queue(message) if topic == @ns + '/notifications'
        end
      end
      
      def disconnect
        @subscriber.unsubscribe(@ns + '/notifications')
      end
      
      def create_client(&callback)
        init
        client_id = Faye.random
        @redis.sadd(@ns + '/clients', client_id) do |added|
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
        @redis.srem(@ns + '/clients', client_id)
        @redis.del(@ns + "/clients/#{client_id}/messages")
        
        remove_timeout(client_id)
        @redis.del(@ns + "/clients/#{client_id}/ping")
        
        @redis.smembers(@ns + "/clients/#{client_id}/channels") do |channels|
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
        @redis.sismember(@ns + '/clients', client_id) do |exists|
          callback.call(exists != 0)
        end
      end
      
      def ping(client_id)
        timeout = @options[:timeout]
        time    = Time.now.to_i.to_s
        
        return unless Numeric === timeout
        
        debug 'Ping ?, ?', client_id, timeout
        remove_timeout(client_id)
        @redis.set(@ns + "/clients/#{client_id}/ping", time)
        add_timeout(client_id, 2 * timeout) do
          @redis.get(@ns + "/clients/#{client_id}/ping") do |ping|
            destroy_client(client_id) if ping == time
          end
        end
      end
      
      def subscribe(client_id, channel, &callback)
        init
        @redis.sadd(@ns + "/clients/#{client_id}/channels", channel)
        @redis.sadd(@ns + "/channels#{channel}", client_id) do
          debug 'Subscribed client ? to channel ?', client_id, channel
          callback.call if callback
        end
      end
      
      def unsubscribe(client_id, channel, &callback)
        init
        @redis.srem(@ns + "/clients/#{client_id}/channels", channel)
        @redis.srem(@ns + "/channels#{channel}", client_id) do
          debug 'Unsubscribed client ? from channel ?', client_id, channel
          callback.call if callback
        end
      end
      
      def publish(message)
        init
        debug 'Publishing message ?', message
        
        json_message = JSON.dump(message)
        channels     = Channel.expand(message['channel'])
        keys         = channels.map { |c| @ns + "/channels#{c}" }
        
        @redis.sunion(*keys) do |clients|
          clients.each do |client_id|
            debug 'Queueing for client ?: ?', client_id, message
            @redis.sadd(@ns + "/clients/#{client_id}/messages", json_message)
            @redis.publish(@ns + '/notifications', client_id)
          end
        end
      end
      
    private
      
      def empty_queue(client_id)
        return unless conn = connection(client_id, false)
        init
        
        key = @ns + "/clients/#{client_id}/messages"
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
