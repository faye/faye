module Faye
  class Transport

    include Logging
    include Publisher
    include Timeouts

    attr_reader :endpoint

    def initialize(client, endpoint)
      super()
      @client   = client
      @endpoint = endpoint
      @outbox   = []
    end

    def batching?
      true
    end

    def close
    end

    def encode(envelopes)
      ''
    end

    def connection_type
      self.class.connection_type
    end

    def send(envelope)
      message = envelope.message
      client_id = @client.instance_eval { @client_id }
      debug('Client ? sending message to ?: ?', client_id, @endpoint, message)

      return request([envelope]) unless batching?

      @outbox << envelope

      if message['channel'] == Channel::HANDSHAKE
        return add_timeout(:publish, 0.01) { flush }
      end

      if message['channel'] == Channel::CONNECT
        @connection_message = message
      end

      flush_large_batch
      add_timeout(:publish, Engine::MAX_DELAY) { flush }
    end

    def flush
      remove_timeout(:publish)

      if @outbox.size > 1 and @connection_message
        @connection_message['advice'] = {'timeout' => 0}
      end

      request(@outbox)

      @connection_message = nil
      @outbox = []
    end

    def flush_large_batch
      string = encode(@outbox)
      return if string.size < @client.max_request_size
      last = @outbox.pop
      flush
      @outbox.push(last) if last
    end

    def receive(envelopes, responses)
      envelopes.each { |e| e.set_deferred_status(:succeeded) }
      responses = [responses].flatten
      client_id = @client.instance_eval { @client_id }
      debug('Client ? received from ?: ?', client_id, @endpoint, responses)
      responses.each { |response| @client.receive_message(response) }
    end

    def handle_error(envelopes, immediate = false)
      envelopes.each { |e| e.set_deferred_status(:failed, immediate) }
    end

  private

    def get_cookies
      return @client.cookies
      @client.cookies.get_cookies(@endpoint.to_s) * ';'
    end

    def store_cookies(set_cookie)
      return @client.cookies
      [*set_cookie].compact.each do |cookie|
        @client.cookies.set_cookie(@endpoint.to_s, cookie)
      end
    end

    @transports = []

    class << self
      attr_accessor :connection_type

      def get(client, allowed, disabled, &callback)
        endpoint = client.endpoint

        select = lambda do |(conn_type, klass), resume|
          conn_endpoint = client.endpoints[conn_type] || endpoint

          if disabled.include?(conn_type)
            next resume.call
          end

          unless allowed.include?(conn_type)
            klass.usable?(client, conn_endpoint) { |u| }
            next resume.call
          end

          klass.usable?(client, conn_endpoint) do |is_usable|
            next resume.call unless is_usable
            transport = klass.respond_to?(:create) ? klass.create(client, conn_endpoint) : klass.new(client, conn_endpoint)
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
    end

    %w[local web_socket http].each do |type|
      require File.join(ROOT, 'faye', 'transport', type)
    end

  end
end

