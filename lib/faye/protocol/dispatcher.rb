module Faye
  class Dispatcher

    class Envelope < Struct.new(:message, :timeout, :request, :timer)
    end

    MAX_REQUEST_SIZE = 2048
    DEFAULT_RETRY    = 5.0

    UP   = 1
    DOWN = 2

    include Publisher
    include Logging
    extend Forwardable
    def_delegators :@transport, :connection_type

    attr_accessor :client_id, :timeout
    attr_reader   :cookies, :endpoint, :headers, :max_request_size, :retry, :transports

    def initialize(client, endpoint, options)
      super()

      @client     = client
      @endpoint   = Faye.parse_url(endpoint)
      @alternates = options[:endpoints] || {}

      @cookies    = CookieJar::Jar.new
      @disabled   = []
      @envelopes  = {}
      @headers    = {}
      @retry      = options[:retry] || DEFAULT_RETRY
      @state      = 0
      @transports = {}

      @alternates.each do |type, url|
        @alternates[type] = Faye.parse_url(url)
      end

      @max_request_size = MAX_REQUEST_SIZE
    end

    def endpoint_for(connection_type)
      @alternates[connection_type] || @endpoint
    end

    def disable(feature)
      @disabled << feature
    end

    def set_header(name, value)
      @headers[name.to_s] = value.to_s
    end

    def close
      transport = @transport
      @transport = nil
      transport.close if transport
    end

    def select_transport(transport_types)
      Transport.get(self, transport_types, @disabled) do |transport|
        debug('Selected ? transport for ?', transport.connection_type, transport.endpoint)

        next if transport == @transport
        @transport.close if @transport

        @transport = transport
      end
    end

    def send_message(message, timeout)
      return unless @transport

      id = message['id']
      envelope = @envelopes[id] ||= Envelope.new(message, timeout, nil, nil)

      return if envelope.request or envelope.timer

      envelope.timer = EventMachine.add_timer(timeout) do
        handle_error(message, false)
      end

      envelope.request = @transport.send_message(message)
    end

    def handle_response(reply)
      if reply.has_key?('successful') and envelope = @envelopes.delete(reply['id'])
        EventMachine.cancel_timer(envelope.timer) if envelope.timer
      end

      trigger(:message, reply)

      return if @state == UP
      @state = UP
      @client.trigger('transport:up')
    end

    def handle_error(message, immediate)
      return unless envelope = @envelopes[message['id']]
      return unless request = envelope.request

      request.callback do |req|
        req.close if req.respond_to?(:close)
      end

      EventMachine.cancel_timer(envelope.timer)
      envelope.request = envelope.timer = nil

      if immediate
        send_message(envelope.message, envelope.timeout)
      else
        envelope.timer = EventMachine.add_timer(@rety) do
          envelope.timer = nil
          send_message(envelope.message, envelope.timeout)
        end
      end

      return if @state == DOWN
      @state = DOWN
      @client.trigger('transport:down')
    end

  end
end
