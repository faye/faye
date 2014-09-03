module Faye
  module Engine

    class Memory
      include Timeouts

      def self.create(server, options)
        new(server, options)
      end

      def initialize(server, options)
        @server    = server
        @options   = options
        reset
      end

      def disconnect
        reset
        remove_all_timeouts
      end

      def reset
        @namespace = Namespace.new
        @clients   = {}
        @channels  = {}
        @messages  = {}
      end

      def create_client(&callback)
        client_id = @namespace.generate
        @server.debug('Created new client ?', client_id)
        ping(client_id)
        @server.trigger(:handshake, client_id)
        callback.call(client_id)
      end

      def destroy_client(client_id, &callback)
        return unless @namespace.exists?(client_id)

        if @clients.has_key?(client_id)
          @clients[client_id].each { |channel| unsubscribe(client_id, channel) }
        end

        remove_timeout(client_id)
        @namespace.release(client_id)
        @messages.delete(client_id)
        @server.debug('Destroyed client ?', client_id)
        @server.trigger(:disconnect, client_id)
        @server.trigger(:close, client_id)
        callback.call if callback
      end

      def client_exists(client_id, &callback)
        callback.call(@namespace.exists?(client_id))
      end

      def ping(client_id)
        timeout = @server.timeout
        return unless Numeric === timeout
        @server.debug('Ping ?, ?', client_id, timeout)
        remove_timeout(client_id)
        add_timeout(client_id, 2 * timeout) { destroy_client(client_id) }
      end

      def subscribe(client_id, channel, &callback)
        @clients[client_id] ||= Set.new
        should_trigger = @clients[client_id].add?(channel)

        @channels[channel] ||= Set.new
        @channels[channel].add(client_id)

        @server.debug('Subscribed client ? to channel ?', client_id, channel)
        @server.trigger(:subscribe, client_id, channel) if should_trigger
        callback.call(true) if callback
      end

      def unsubscribe(client_id, channel, &callback)
        if @clients.has_key?(client_id)
          should_trigger = @clients[client_id].delete?(channel)
          @clients.delete(client_id) if @clients[client_id].empty?
        end

        if @channels.has_key?(channel)
          @channels[channel].delete(client_id)
          @channels.delete(channel) if @channels[channel].empty?
        end

        @server.debug('Unsubscribed client ? from channel ?', client_id, channel)
        @server.trigger(:unsubscribe, client_id, channel) if should_trigger
        callback.call(true) if callback
      end

      def publish(message, channels)
        @server.debug('Publishing message ?', message)

        clients = Set.new

        channels.each do |channel|
          next unless subs = @channels[channel]
          subs.each(&clients.method(:add))
        end

        clients.each do |client_id|
          @server.debug('Queueing for client ?: ?', client_id, message)
          @messages[client_id] ||= []
          @messages[client_id] << Faye.copy_object(message)
          empty_queue(client_id)
        end

        @server.trigger(:publish, message['clientId'], message['channel'], message['data'])
      end

      def empty_queue(client_id)
        return unless @server.has_connection?(client_id)
        @server.deliver(client_id, @messages[client_id])
        @messages.delete(client_id)
      end
    end

  end
end
