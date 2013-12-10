module Faye

  class Transport::WebSocket < Transport
    UNCONNECTED = 1
    CONNECTING  = 2
    CONNECTED   = 3

    PROTOCOLS = {
      'http'  => 'ws',
      'https' => 'wss'
    }

    include Deferrable

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

    def request(envelopes)
      @pending ||= Set.new
      envelopes.each { |envelope| @pending.add(envelope) }

      callback do |socket|
        next unless socket
        messages = envelopes.map { |e| e.message }
        socket.send(Faye.to_json(messages))
      end
      connect
    end

    def connect
      @state ||= UNCONNECTED
      return unless @state == UNCONNECTED
      @state = CONNECTING

      headers = @client.headers.dup
      headers['Cookie'] = get_cookies

      url = @endpoint.dup
      url.scheme = PROTOCOLS[url.scheme]
      socket = Faye::WebSocket::Client.new(url.to_s, [], :headers => headers)

      socket.onopen = lambda do |*args|
        store_cookies(socket.headers['Set-Cookie'])
        @socket = socket
        @state = CONNECTED
        @ever_connected = true
        ping
        set_deferred_status(:succeeded, socket)
      end

      closed = false
      socket.onclose = socket.onerror = lambda do |*args|
        next if closed
        closed = true

        was_connected = (@state == CONNECTED)
        socket.onopen = socket.onclose = socket.onerror = socket.onmessage = nil

        @socket = nil
        @state = UNCONNECTED
        remove_timeout(:ping)
        set_deferred_status(:unknown)

        pending  = @pending ? @pending.to_a : []
        @pending = nil

        if was_connected
          handle_error(pending, true)
        elsif @ever_connected
          handle_error(pending)
        else
          set_deferred_status(:failed)
        end
      end

      socket.onmessage = lambda do |event|
        messages  = MultiJson.load(event.data)
        envelopes = []

        next if messages.nil?
        messages = [messages].flatten

        messages.each do |message|
          next unless message.has_key?('successful')
          next unless envelope = @pending.find { |e| e.id == message['id'] }
          @pending.delete(envelope)
          envelopes << envelope
        end
        receive(envelopes, messages)
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
