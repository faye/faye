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

    def request(messages, timeout = nil)
      return if messages.empty?
      @messages ||= {}
      messages.each { |message| @messages[message['id']] = message }
      callback do |socket|
        socket.send(Faye.to_json(messages)) if socket
      end
      connect
    end

    def close
      return unless @socket
      @socket.onclose = @socket.onerror = nil
      @socket.close
      @socket = nil
      set_deferred_status(:deferred)
      @state = UNCONNECTED
    end

    def connect
      @state ||= UNCONNECTED
      return unless @state == UNCONNECTED

      @state = CONNECTING

      url = @endpoint.dup
      url.scheme = PROTOCOLS[url.scheme]
      @socket = Faye::WebSocket::Client.new(url.to_s, [], :headers => @client.headers)

      @socket.onopen = lambda do |*args|
        @state = CONNECTED
        @ever_connected = true
        set_deferred_status(:succeeded, @socket)
        trigger(:up)
      end

      @socket.onmessage = lambda do |event|
        messages = MultiJson.load(event.data)
        next if messages.nil?
        messages = [messages].flatten
        messages.each { |message| @messages.delete(message['id']) }
        receive(messages)
      end

      @socket.onclose = @socket.onerror = lambda do |*args|
        was_connected = (@state == CONNECTED)
        set_deferred_status(:deferred)
        @state = UNCONNECTED

        close

        next resend if was_connected
        next set_deferred_status(:failed) unless @ever_connected

        EventMachine.add_timer(@client.retry) { connect }
        trigger(:down)
      end
    end

    def resend
      return unless @messages
      request(@messages.values)
    end
  end

  Transport.register 'websocket', Transport::WebSocket

end
