module Faye
  module Publisher
    
    def count_subscribers(event_type)
      return 0 unless @subscribers and @subscribers[event_type]
      @subscribers[event_type].size
    end
    
    def add_subscriber(event_type, listener)
      @subscribers ||= {}
      list = @subscribers[event_type] ||= []
      list << listener
    end
    
    def remove_subscriber(event_type, listener)
      return unless @subscribers and @subscribers[event_type]
      @subscribers[event_type].delete_if(&listener.method(:==))
    end
    
    def publish_event(event_type, *args)
      return unless @subscribers and @subscribers[event_type]
      @subscribers[event_type].each do |listener|
        listener.call(*args)
      end
    end
    
  end
end

