module Faye
  module Timeouts
    def add_timeout(name, delay, &block)
      Engine.ensure_reactor_running!
      @timeouts ||= {}
      return if @timeouts.has_key?(name)
      @timeouts[name] = EventMachine.add_timer(delay) do
        @timeouts.delete(name)
        block.call
      end
    end

    def remove_timeout(name)
      @timeouts ||= {}
      timeout = @timeouts[name]
      return if timeout.nil?
      EventMachine.cancel_timer(timeout)
      @timeouts.delete(name)
    end

    def remove_all_timeouts
      @timeouts ||= {}
      @timeouts.keys.each { |name| remove_timeout(name) }
    end
  end
end
