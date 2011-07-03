module Faye
  module Engine
    
    class Redis < Base
      DEFAULT_HOST     = 'localhost'
      DEFAULT_PORT     = 6379
      DEFAULT_DATABASE = 0
      DEFAULT_GC       = 10
      
      def init
        return if @redis
        require 'em-hiredis'
        
        host = @options[:host]      || DEFAULT_HOST
        port = @options[:port]      || DEFAULT_PORT
        db   = @options[:database]  || 0
        auth = @options[:password]
        gc   = @options[:gc]        || DEFAULT_GC
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
        
        EventMachine.add_periodic_timer(gc, &method(:gc))
      end
      
      def disconnect
        @subscriber.unsubscribe(@ns + '/notifications')
      end
      
      def create_client(&callback)
        init
        client_id = Faye.random
        @redis.zadd(@ns + '/clients', 0, client_id) do |added|
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
        @redis.zrem(@ns + '/clients', client_id)
        @redis.del(@ns + "/clients/#{client_id}/messages")
        
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
        @redis.zscore(@ns + '/clients', client_id) do |score|
          callback.call(score != nil)
        end
      end
      
      def ping(client_id)
        init
        return unless Numeric === @timeout
        
        time = Time.now.to_i
        debug 'Ping ?, ?', client_id, time
        @redis.zadd(@ns + '/clients', time, client_id)
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
            @redis.rpush(@ns + "/clients/#{client_id}/messages", json_message)
            @redis.publish(@ns + '/notifications', client_id)
          end
        end
      end
      
    private
      
      def empty_queue(client_id)
        return unless conn = connection(client_id, false)
        init
        
        key = @ns + "/clients/#{client_id}/messages"
        @redis.lrange(key, 0, -1) do |json_messages|
          @redis.ltrim(key, json_messages.size, -1)
          json_messages.each do |json_message|
            conn.deliver(JSON.parse(json_message))
          end
        end
      end
      
      def gc
        return unless Numeric === @timeout
        
        cutoff = Time.now.to_i - 2 * @timeout
        @redis.zrangebyscore(@ns + '/clients', 0, cutoff) do |clients|
          clients.each { |client_id| destroy_client(client_id) }
        end
      end
    end
    
    register 'redis', Redis
    
  end
end
