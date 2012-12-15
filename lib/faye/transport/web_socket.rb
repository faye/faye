module Faye
  
  class Transport::WebSocket < Transport
    UNCONNECTED       = 1
    CONNECTING        = 2
    CONNECTED         = 3
    
    include EventMachine::Deferrable
    
    def self.usable?(client, endpoint, &callback)
      create(client, endpoint).usable?(&callback)
    end
    
    def self.create(client, endpoint)
      sockets = client.transports[:websocket] ||= {}
      sockets[endpoint] ||= new(client, endpoint)
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
      callback { |socket| socket.send(Faye.to_json(messages)) }
      connect
    end
    
    def close
      return if @closed
      @closed = true
      @socket.close if @socket
    end
    
    def connect
      return if @closed
      
      @state ||= UNCONNECTED
      return unless @state == UNCONNECTED
      
      @state = CONNECTING
      
      @socket = Faye::WebSocket::Client.new(@endpoint.gsub(/^http(s?):/, 'ws\1:'))
      
      @socket.onopen = lambda do |*args|
        @state = CONNECTED
        @ever_connected = true
        set_deferred_status(:succeeded, @socket)
        trigger(:up)
      end
      
      @socket.onmessage = lambda do |event|
        messages = [Yajl::Parser.parse(event.data)].flatten
        messages.each { |message| @messages.delete(message['id']) }
        receive(messages)
      end
      
      @socket.onclose = lambda do |*args|
        was_connected = (@state == CONNECTED)
        set_deferred_status(:deferred)
        @state = UNCONNECTED
        @socket = nil
        
        next resend if was_connected
        next set_deferred_status(:failed) unless @ever_connected
        
        EventMachine.add_timer(@client.retry) { connect }
        trigger(:down)
      end
    end
    
    def resend
      if @messages && !@messages.empty?
        request(@messages.values)
      else
        # needs handshake / connect
        @client.reconnect
      end
    end
  end
  
  Transport.register 'websocket', Transport::WebSocket
  
end
