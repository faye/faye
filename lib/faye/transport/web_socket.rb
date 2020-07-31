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

    class Request
      include Deferrable

      def close
        callback { |socket| socket.close }
      end
    end

    def self.usable?(dispatcher, endpoint, &callback)
      create(dispatcher, endpoint).usable?(&callback)
    end

    def self.create(dispatcher, endpoint)
      sockets = dispatcher.transports[:websocket] ||= {}
      sockets[endpoint.to_s] ||= new(dispatcher, endpoint)
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
      @pending ||= Set.new
      messages.each { |message| @pending.add(message) }

      promise = Request.new

      callback do |socket|
        next unless socket and socket.ready_state == 1
        socket.send(Faye.to_json(messages))
        promise.succeed(socket)
      end

      connect
      promise
    end

    def connect
      @state ||= UNCONNECTED
      return unless @state == UNCONNECTED
      @state = CONNECTING

      url        = @endpoint.dup
      headers    = @dispatcher.headers.dup
      extensions = @dispatcher.ws_extensions
      cookie     = get_cookies

      url.scheme = PROTOCOLS[url.scheme]
      headers['Cookie'] = cookie unless cookie == ''

      options = {
        :extensions => extensions,
        :headers    => headers,
        :proxy      => @proxy,
        :tls        => @dispatcher.tls
      }

      socket = Faye::WebSocket::Client.new(url.to_s, [], options)

      socket.onopen = lambda do |*args|
        store_cookies(socket.headers['Set-Cookie'])
        @socket = socket
        @state = CONNECTED
        @ever_connected = true
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

        pending  = @pending ? @pending.to_a : []
        @pending = nil

        if was_connected or @ever_connected
          set_deferred_status(:unknown)
          handle_error(pending, was_connected)
        else
          set_deferred_status(:failed)
        end
      end

      socket.onmessage = lambda do |event|
        replies = MultiJson.load(event.data) rescue nil
        next if replies.nil?
        replies = [replies].flatten

        replies.each do |reply|
          next unless reply.has_key?('successful')
          next unless message = @pending.find { |m| m['id'] == reply['id'] }
          @pending.delete(message)
        end
        receive(replies)
      end
    end

    def close
      return unless @socket
      @socket.close
    end
  end

  Transport.register 'websocket', Transport::WebSocket

end
