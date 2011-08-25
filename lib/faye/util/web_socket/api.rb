module Faye
  class WebSocket
    
    module API
      attr_reader   :url, :ready_state, :buffered_amount
      attr_accessor :onopen, :onmessage, :onerror, :onclose
      
      include Publisher
      
      def receive(data)
        event = Event.new
        event.init_event('message', false, false)
        event.data = Faye.encode(data)
        dispatch_event(event)
      end
      
      def send(data, type = nil, error_type = nil)
        frame = @parser.frame(Faye.encode(data), type, error_type)
        @stream.write(frame) if frame
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
    end
    
    class Event
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
end
