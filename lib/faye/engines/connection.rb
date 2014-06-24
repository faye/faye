module Faye
  module Engine

    class Connection
      include Deferrable
      include Timeouts

      attr_accessor :socket

      def initialize(engine, id, options = {})
        @engine  = engine
        @id      = id
        @options = options
        @inbox   = Set.new
      end

      def deliver(message)
        message.delete('clientId')
        return @socket.send(message) if @socket
        return unless @inbox.add?(message)
        begin_delivery_timeout
      end

      def connect(options, &block)
        options = options || {}
        timeout = options['timeout'] ? options['timeout'] / 1000.0 : @engine.timeout

        set_deferred_status(:unknown)
        callback(&block)

        begin_delivery_timeout
        begin_connection_timeout(timeout)
      end

      def flush
        remove_timeout(:connection)
        remove_timeout(:delivery)

        set_deferred_status(:succeeded, @inbox.entries)
        @inbox = []

        @engine.close_connection(@id) unless @socket
      end

    private

      def begin_delivery_timeout
        return if @inbox.empty?
        add_timeout(:delivery, MAX_DELAY) { flush }
      end

      def begin_connection_timeout(timeout)
        add_timeout(:connection, timeout) { flush }
      end
    end

  end
end
