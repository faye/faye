module Faye
  module Publisher
    
    def count_listeners(event_type)
      return 0 unless @subscribers and @subscribers[event_type]
      @subscribers[event_type].size
    end
    
    def bind(event_type, &listener)
      @subscribers ||= {}
      list = @subscribers[event_type] ||= []
      list << listener
    end
    
    def unbind(event_type, &listener)
      return unless @subscribers and @subscribers[event_type]
      return @subscribers.delete(event_type) unless listener
      
      @subscribers[event_type].delete_if(&listener.method(:==))
    end
    
    def trigger(event_type, *args)
      return unless @subscribers and @subscribers[event_type]
      listeners = @subscribers[event_type].dup
      listeners.each { |listener| listener.call(*args) }
    end
    
  end
end

