module Faye
  class Dispatcher

    class Envelope < Struct.new(:message, :scheduler, :request, :timer)
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
    attr_reader   :endpoint, :tls, :headers, :cookies, :proxy, :retry
    attr_reader   :max_request_size, :transports, :ws_extensions

    def initialize(client, endpoint, options)
      super()

      @client     = client
      @endpoint   = String === endpoint ? URI(endpoint) : endpoint
      @alternates = options[:endpoints] || {}

      @cookies       = CookieJar::Jar.new
      @disabled      = []
      @envelopes     = {}
      @headers       = {}
      @retry         = options[:retry] || DEFAULT_RETRY
      @scheduler     = options[:scheduler] || Faye::Scheduler
      @state         = 0
      @transports    = {}
      @ws_extensions = []

      @proxy = options[:proxy] || {}
      @proxy = { :origin => @proxy } if String === @proxy

      [*options[:websocket_extensions]].each do |extension|
        add_websocket_extension(extension)
      end

      @tls = { :verify_peer => true }.merge(options[:tls] || {})

      @alternates.each do |type, url|
        @alternates[type] = URI(url)
      end

      @max_request_size = MAX_REQUEST_SIZE
    end

    def endpoint_for(connection_type)
      @alternates[connection_type] || @endpoint
    end

    def add_websocket_extension(extension)
      @ws_extensions << extension
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

    def connection_types
      Transport.connection_types
    end

    def select_transport(transport_types)
      Transport.get(self, transport_types, @disabled) do |transport|
        debug('Selected ? transport for ?', transport.connection_type, transport.endpoint)

        next if transport == @transport
        @transport.close if @transport

        @transport = transport
      end
    end

    def send_message(message, timeout, options = {})
      id       = message['id']
      attempts = options[:attempts]
      deadline = options[:deadline] && Time.now.to_f + options[:deadline]
      envelope = @envelopes[id]

      unless envelope
        scheduler = @scheduler.new(message, :timeout => timeout, :interval => @retry, :attempts => attempts, :deadline => deadline)
        envelope  = @envelopes[id] = Envelope.new(message, scheduler, nil, nil)
      end

      send_envelope(envelope)
    end

    def send_envelope(envelope)
      return unless @transport
      return if envelope.request or envelope.timer

      message   = envelope.message
      scheduler = envelope.scheduler

      unless scheduler.deliverable?
        scheduler.abort!
        @envelopes.delete(message['id'])
        return
      end

      envelope.timer = EventMachine.add_timer(scheduler.timeout) do
        handle_error(message)
      end

      scheduler.send!
      envelope.request = @transport.send_message(message)
    end
    private :send_envelope

    def handle_response(reply)
      if reply.has_key?('successful') and envelope = @envelopes.delete(reply['id'])
        envelope.scheduler.succeed!
        EventMachine.cancel_timer(envelope.timer) if envelope.timer
      end

      trigger(:message, reply)

      return if @state == UP
      @state = UP
      @client.trigger('transport:up')
    end

    def handle_error(message, immediate = false)
      return unless envelope = @envelopes[message['id']]
      return unless request = envelope.request

      request.callback do |req|
        req.close if req.respond_to?(:close)
      end

      scheduler = envelope.scheduler
      scheduler.fail!

      EventMachine.cancel_timer(envelope.timer)
      envelope.request = envelope.timer = nil

      if immediate
        send_envelope(envelope)
      else
        envelope.timer = EventMachine.add_timer(scheduler.interval) do
          envelope.timer = nil
          send_envelope(envelope)
        end
      end

      return if @state == DOWN
      @state = DOWN
      @client.trigger('transport:down')
    end

  end
end
