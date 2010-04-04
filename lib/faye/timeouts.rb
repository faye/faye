module Faye
  module Timeouts
    def add_timeout(name, delay, &block)
      @timeouts ||= {}
      return if @timeouts.has_key?(name)
      @timeouts[name] = EventMachine.add_timer(delay, &block)
    end
    
    def remove_timeout(name)
      @timeouts ||= {}
      timeout = @timeouts[name]
      return if timeout.nil?
      EventMachine.cancel_timer(timeout)
      @timeouts.delete(name)
    end
  end
end

