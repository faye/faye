module Faye
  class Transport

    include Logging
    include Publisher
    include Timeouts

    DEFAULT_PORTS = { 'http' => 80, 'https' => 433, 'ws' => 80, 'wss' => 443 }

    attr_reader :endpoint

    def initialize(dispatcher, endpoint)
      super()
      @dispatcher = dispatcher
      @endpoint   = endpoint
      @outbox     = []
      @proxy      = @dispatcher.proxy.dup

      @proxy[:origin] ||= @endpoint.respond_to?(:find_proxy) ?
                          @endpoint.find_proxy :
                          nil
    end

    def batching?
      true
    end

    def close
    end

    def encode(messages)
      ''
    end

    def connection_type
      self.class.connection_type
    end

    def send_message(message)
      debug('Client ? sending message to ? via ?: ?', @dispatcher.client_id, @endpoint, connection_type, message)

      unless batching?
        promise = EventMachine::DefaultDeferrable.new
        promise.succeed(request([message]))
        return promise
      end

      @outbox << message
      flush_large_batch

      if message['channel'] == Channel::HANDSHAKE
        return publish(0.01)
      end

      if message['channel'] == Channel::CONNECT
        @connection_message = message
      end

      publish(Engine::MAX_DELAY)
    end

  private

    def publish(delay)
      @promise ||= EventMachine::DefaultDeferrable.new

      add_timeout(:publish, delay) do
        flush
        @promise = nil
      end

      @promise
    end

    def flush
      remove_timeout(:publish)

      if @outbox.size > 1 and @connection_message
        @connection_message['advice'] = { 'timeout' => 0 }
      end

      @promise.succeed(request(@outbox))

      @connection_message = nil
      @outbox = []
    end

    def flush_large_batch
      string = encode(@outbox)
      return if string.size < @dispatcher.max_request_size
      last = @outbox.pop

      @promise ||= EventMachine::DefaultDeferrable.new
      flush

      @outbox.push(last) if last
    end

    def receive(replies)
      return unless replies
      replies = [replies].flatten

      debug('Client ? received from ? via ?: ?', @dispatcher.client_id, @endpoint, connection_type, replies)

      replies.each do |reply|
        @dispatcher.handle_response(reply)
      end
    end

    def handle_error(messages, immediate = false)
      debug('Client ? failed to send to ? via ?: ?', @dispatcher.client_id, @endpoint, connection_type, messages)

      messages.each do |message|
        @dispatcher.handle_error(message, immediate)
      end
    end

    def get_cookies
      @dispatcher.cookies.get_cookies(@endpoint.to_s) * ';'
    end

    def store_cookies(set_cookie)
      [*set_cookie].compact.each do |cookie|
        @dispatcher.cookies.set_cookie(@endpoint.to_s, cookie)
      end
    end

    @transports = []

    class << self
      attr_accessor :connection_type

      def get(dispatcher, allowed, disabled, &callback)
        endpoint = dispatcher.endpoint

        select = lambda do |(conn_type, klass), resume|
          conn_endpoint = dispatcher.endpoint_for(conn_type)

          if disabled.include?(conn_type)
            next resume.call
          end

          unless allowed.include?(conn_type)
            klass.usable?(dispatcher, conn_endpoint) { |u| }
            next resume.call
          end

          klass.usable?(dispatcher, conn_endpoint) do |is_usable|
            next resume.call unless is_usable
            transport = klass.respond_to?(:create) ? klass.create(dispatcher, conn_endpoint) : klass.new(dispatcher, conn_endpoint)
            callback.call(transport)
          end
        end

        error = lambda do
          raise "Could not find a usable connection type for #{ endpoint }"
        end

        Faye.async_each(@transports, select, error)
      end

      def register(type, klass)
        @transports << [type, klass]
        klass.connection_type = type
      end

      def connection_types
        @transports.map { |t| t[0] }
      end
    end

    %w[local web_socket http].each do |type|
      require File.join(ROOT, 'faye', 'transport', type)
    end

  end
end
