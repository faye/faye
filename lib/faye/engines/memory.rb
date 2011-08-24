module Faye
  module Engine
    
    class Memory < Base
      include Timeouts
      
      def initialize(options)
        @namespace = Namespace.new
        @clients   = {}
        @channels  = {}
        @messages  = {}
        super
      end
      
      def create_client(&callback)
        client_id = @namespace.generate
        debug 'Created new client ?', client_id
        ping(client_id)
        callback.call(client_id)
        trigger(:handshake, client_id)
      end
      
      def destroy_client(client_id, &callback)
        return unless @namespace.exists?(client_id)
        
        if @clients.has_key?(client_id)
          @clients[client_id].each { |channel| unsubscribe(client_id, channel) }
        end
        
        remove_timeout(client_id)
        @namespace.release(client_id)
        @messages.delete(client_id)
        debug 'Destroyed client ?', client_id
        callback.call if callback
        trigger(:disconnect, client_id)
      end
      
      def client_exists(client_id, &callback)
        callback.call(@namespace.exists?(client_id))
      end
      
      def ping(client_id)
        return unless Numeric === @timeout
        debug 'Ping ?, ?', client_id, @timeout
        remove_timeout(client_id)
        add_timeout(client_id, 2 * @timeout) { destroy_client(client_id) }
      end
      
      def subscribe(client_id, channel, &callback)
        @clients[client_id] ||= Set.new
        @clients[client_id].add(channel)
        
        @channels[channel] ||= Set.new
        @channels[channel].add(client_id)
        
        debug 'Subscribed client ? to channel ?', client_id, channel
        callback.call(true) if callback
        trigger(:subscribe, client_id, channel)
      end
      
      def unsubscribe(client_id, channel, &callback)
        should_trigger = if @clients.has_key?(client_id)
          @clients[client_id].delete(channel)
          @clients.delete(client_id) if @clients[client_id].empty?
          true
        end
        
        if @channels.has_key?(channel)
          @channels[channel].delete(client_id)
          @channels.delete(channel) if @channels[channel].empty?
        end
        
        debug 'Unsubscribed client ? from channel ?', client_id, channel
        callback.call(true) if callback
        trigger(:unsubscribe, client_id, channel) if should_trigger
      end
      
      def publish(message)
        debug 'Publishing message ?', message
        
        channels = Channel.expand(message['channel'])
        clients  = Set.new
        
        channels.each do |channel|
          next unless subs = @channels[channel]
          subs.each(&clients.method(:add))
        end
        
        clients.each do |client_id|
          debug 'Queueing for client ?: ?', client_id, message
          @messages[client_id] ||= []
          @messages[client_id] << message
          empty_queue(client_id)
          trigger(:receive, client_id, message['channel'], message['data'])
        end

        trigger(:publish, message['clientId'], message['channel'], message['data'])
      end
      
    private
      
      def empty_queue(client_id)
        return unless conn = connection(client_id, false) and
               messages = @messages.delete(client_id)
        
        messages.each(&conn.method(:deliver))
      end
    end
    
    register 'memory', Memory
    
  end
end

