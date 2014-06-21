module Faye
  module Engine

    METHODS   = %w[create_client client_exists destroy_client ping subscribe unsubscribe]
    MAX_DELAY = 0.0
    INTERVAL  = 0.0
    TIMEOUT   = 60.0
    ID_LENGTH = 160

    autoload :Connection, File.expand_path('../connection', __FILE__)
    autoload :Memory,     File.expand_path('../memory', __FILE__)

    def self.ensure_reactor_running!
      Thread.new { EventMachine.run } unless EventMachine.reactor_running?
      Thread.pass until EventMachine.reactor_running?
    end

    def self.get(options)
      Proxy.new(options)
    end

    def self.random(bitlength = ID_LENGTH)
      limit    = 2 ** bitlength
      max_size = (bitlength * Math.log(2) / Math.log(36)).ceil
      string   = SecureRandom.random_number(limit).to_s(36)
      string   = '0' + string while string.size < max_size
      string
    end

    class Proxy
      include Publisher
      include Logging

      attr_reader :interval, :timeout

      extend Forwardable
      def_delegators :@engine, *METHODS

      def initialize(options)
        super()

        @options     = options
        @connections = {}
        @interval    = @options[:interval] || INTERVAL
        @timeout     = @options[:timeout]  || TIMEOUT

        engine_class = @options[:type] || Memory
        @engine      = engine_class.create(self, @options)

        bind :close do |client_id|
          EventMachine.next_tick { flush_connection(client_id) }
        end

        debug('Created new engine: ?', @options)
      end

      def connect(client_id, options = {}, &callback)
        debug('Accepting connection from ?', client_id)
        @engine.ping(client_id)
        conn = connection(client_id, true)
        conn.connect(options, &callback)
        @engine.empty_queue(client_id)
      end

      def has_connection?(client_id)
        @connections.has_key?(client_id)
      end

      def connection(client_id, create)
        conn = @connections[client_id]
        return conn if conn or not create
        @connections[client_id] = Connection.new(self, client_id)
        trigger('connection:open', client_id)
        @connections[client_id]
      end

      def close_connection(client_id)
        debug('Closing connection for ?', client_id)
        return unless conn = @connections[client_id]
        conn.socket.close if conn.socket
        trigger('connection:close', client_id)
        @connections.delete(client_id)
      end

      def open_socket(client_id, socket)
        conn = connection(client_id, true)
        conn.socket = socket
      end

      def deliver(client_id, messages)
        return if !messages || messages.empty?
        return false unless conn = connection(client_id, false)
        messages.each(&conn.method(:deliver))
        true
      end

      def generate_id
        Engine.random
      end

      def flush_connection(client_id, close = true)
        return unless client_id
        debug('Flushing connection for ?', client_id)
        return unless conn = connection(client_id, false)
        conn.socket = nil unless close
        conn.flush
        close_connection(client_id)
      end

      def close
        @connections.keys.each { |client_id| flush_connection(client_id) }
        @engine.disconnect
      end

      def disconnect
        @engine.disconnect if @engine.respond_to?(:disconnect)
      end

      def publish(message)
        channels = Channel.expand(message['channel'])
        @engine.publish(message, channels)
      end
    end

  end
end
