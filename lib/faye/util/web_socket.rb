module Faye
  class WebSocket
    
    include Publisher
    
    CONNECTING = 0
    OPEN       = 1
    CLOSING    = 2
    CLOSED     = 3
    
    attr_reader   :url, :ready_state, :buffered_amount
    attr_accessor :onopen, :onmessage, :onerror, :onclose
    
    def initialize(request)
      @request  = request
      @callback = @request.env['async.callback']
      @stream   = Stream.new
      @callback.call [200, RackAdapter::TYPE_JSON, @stream]
      
      @url = @request.env['websocket.url']
      @ready_state = OPEN
      @buffered_amount = 0
      
      event = Event.new
      event.init_event('open', false, false)
      dispatch_event(event)
      
      @buffer = []
      @buffering = false
      
      @request.env[Thin::Request::WEBSOCKET_RECEIVE_CALLBACK] = lambda do |data|
        data.each_char(&method(:handle_char))
      end
    end
    
    def send(data)
      string = ["\x00", data, "\xFF"].map(&method(:encode)) * ''
      @stream.write(string)
    end
    
    def close
    end
    
    def add_event_listener(type, listener, use_capture)
      add_subscriber(type, listener)
    end
    
    def remove_event_listener(type, listener, use_capture)
      remove_subscriber(type, listener)
    end
    
    def dispatch_event(event)
      event.target = event.current_target = self
      event.event_phase = Event::AT_TARGET
      
      publish_event(event.type, event)
      callback = __send__("on#{ event.type }")
      callback.call(event) if callback
    end
    
  private
    
    def handle_char(data)
      case data
        when "\x00" then
          @buffering = true
          
        when "\xFF" then
          event = Event.new
          event.init_event('message', false, false)
          event.data = encode(@buffer.join(''))
          
          dispatch_event(event)
          
          @buffer = []
          @buffering = false
          
        else
          @buffer.push(data) if @buffering
      end
    end
    
    def encode(string, encoding = 'UTF-8')
      return string unless string.respond_to?(:force_encoding)
      string.force_encoding(encoding)
    end
    
  end
  
  class WebSocket::Stream
    include EventMachine::Deferrable
    
    def each(&callback)
      @data_callback = callback
    end
    
    def write(data)
      return unless @data_callback
      @data_callback.call(data)
    end
  end
  
  class WebSocket::Event
    attr_reader   :type, :bubbles, :cancelable
    attr_accessor :target, :current_target, :event_phase, :data
    
    CAPTURING_PHASE = 1
    AT_TARGET       = 2
    BUBBLING_PHASE  = 3
    
    def init_event(event_type, can_bubble, cancelable)
      @type       = event_type
      @bubbles    = can_bubble
      @cancelable = cancelable
    end
    
    def stop_propagation
    end
    
    def prevent_default
    end
  end
  
end

