module Faye

  class Transport::WebSocket < Transport
    UNCONNECTED = 1
    CONNECTING  = 2
    CONNECTED   = 3

    PROTOCOLS = {
      'http'  => 'ws',
      'https' => 'wss'
    }

    include EventMachine::Deferrable

    def self.usable?(client, endpoint, &callback)
      create(client, endpoint).usable?(&callback)
    end

    def self.create(client, endpoint)
      sockets = client.transports[:websocket] ||= {}
      sockets[endpoint.to_s] ||= new(client, endpoint)
    end

    def batching?
      false
    end

    def usable?(&callback)
      self.callback { callback.call(true) }
      self.errback { callback.call(false) }
      connect
    end

    def request(messages)
      callback do |socket|
        next unless socket
        messages.each { |message| @pending.add(message) }
        socket.send(Faye.to_json(messages))
      end
      connect
    end

    def connect
      @state ||= UNCONNECTED
      return unless @state == UNCONNECTED
      @state = CONNECTING

      url = @endpoint.dup
      url.scheme = PROTOCOLS[url.scheme]
      socket = Faye::WebSocket::Client.new(url.to_s, [], :headers => @client.headers)

      socket.onopen = lambda do |*args|
        @socket = socket
        @pending = Set.new
        @state = CONNECTED
        @ever_connected = true
        ping
        set_deferred_status(:succeeded, socket)
      end

      closed = false
      socket.onclose = socket.onerror = lambda do |*args|
        return if closed
        closed = true

        was_connected = (@state == CONNECTED)
        socket.onopen = socket.onclose = socket.onerror = socket.onmessage = nil

        @socket = nil
        @state = UNCONNECTED
        remove_timeout(:ping)
        set_deferred_status(:deferred)

        if was_connected
          @client.message_error(@pending.to_a, true) if @pending
        elsif @ever_connected
          @client.message_error(@pending.to_a) if @pending
        else
          set_deferred_status(:failed)
        end
        @pending = nil
      end

      socket.onmessage = lambda do |event|
        messages = MultiJson.load(event.data)
        next if messages.nil?
        messages = [messages].flatten
        messages.each do |message|
          if message.has_key?('successful')
            @pending.delete_if { |m| m['id'] == message['id'] }
          end
        end
        receive(messages)
      end
    end

    def close
      return unless @socket
      @socket.close
    end

  private

    def ping
      return unless @socket
      @socket.send('[]')
      timeout = @client.instance_eval { @advice['timeout'] }
      add_timeout(:ping, timeout/2000.0) { ping }
    end
  end

  Transport.register 'websocket', Transport::WebSocket

end
