module Faye
  module Engine
    
    class Base
      include Timeouts
      
      def initialize(options = {})
        @options = options
      end
      
      def on_message(&block)
        @listeners ||= []
        @listeners << block
      end
      
      def announce(client_id, message)
        return unless @listeners
        @listeners.each { |block| block.call(client_id, message) }
      end
      
      def method_missing(key)
        @options[key.to_sym]
      end
    end
    
    autoload :Memory, File.join(ROOT, 'faye', 'engine', 'memory')
    
  end
end

