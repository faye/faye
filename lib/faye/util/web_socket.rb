module Faye
  class WebSocket
    
    include FrameParser
    include Publisher
    
    CONNECTING = 0
    OPEN       = 1
    CLOSING    = 2
    CLOSED     = 3
    
    attr_reader   :url, :ready_state, :buffered_amount
    attr_accessor :onopen, :onmessage, :onerror, :onclose
    
    def initialize(request)
      super
      
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
      
      @request.env[Thin::Request::WEBSOCKET_RECEIVE_CALLBACK] = method(:receive_data)
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
    
    def on_message(data)
      event = Event.new
      event.init_event('message', false, false)
      event.data = data
      
      dispatch_event(event)
    end
    
    def send_data(data)
      @stream.write(data)
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

