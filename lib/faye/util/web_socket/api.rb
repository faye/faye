module Faye
  class WebSocket
    
    CONNECTING = 0
    OPEN       = 1
    CLOSING    = 2
    CLOSED     = 3
    
    module API
      attr_reader   :url, :ready_state, :buffered_amount
      attr_accessor :onopen, :onmessage, :onerror, :onclose
      
      include Publisher
      
      def receive(data)
        return false unless ready_state == OPEN
        event = Event.new('message')
        event.init_event('message', false, false)
        event.data = data
        dispatch_event(event)
      end
      
      def send(data, type = nil, error_type = nil)
        return false if ready_state == CLOSED
        data = Faye.encode(data) if String === data
        frame = @parser.frame(data, type, error_type)
        @stream.write(frame) if frame
      end
      
      def close(code = nil, reason = nil, ack = true)
        return if [CLOSING, CLOSED].include?(ready_state)
        
        @ready_state = CLOSING
        
        close = lambda do
          @ready_state = CLOSED
          @stream.close_connection_after_writing
          event = Event.new('close', :code => code || 1000, :reason => reason || '')
          event.init_event('close', false, false)
          dispatch_event(event)
        end
        
        if ack
          if @parser.respond_to?(:close)
            @parser.close(code, reason, &close)
          else
            close.call
          end
        else
          @parser.close(code, reason) if @parser.respond_to?(:close)
          close.call
        end
      end
      
      def add_event_listener(type, listener, use_capture)
        bind(type, listener)
      end
      
      def remove_event_listener(type, listener, use_capture)
        unbind(type, listener)
      end
      
      def dispatch_event(event)
        event.target = event.current_target = self
        event.event_phase = Event::AT_TARGET
        
        trigger(event.type, event)
        callback = __send__("on#{ event.type }")
        callback.call(event) if callback
      end
    end
    
    class Event
      attr_reader   :type, :bubbles, :cancelable
      attr_accessor :target, :current_target, :event_phase, :data
      
      CAPTURING_PHASE = 1
      AT_TARGET       = 2
      BUBBLING_PHASE  = 3
      
      def initialize(event_type, options = {})
        @type = event_type
        metaclass = (class << self ; self ; end)
        options.each do |key, value|
          metaclass.__send__(:define_method, key) { value }
        end
      end
      
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
end
