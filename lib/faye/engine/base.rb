module Faye
  module Engine
    
    class Base
      def on_message(&block)
        @listeners ||= []
        @listeners << block
      end
      
      def announce(client_id, message)
        return unless @listeners
        @listeners.each { |block| block.call(client_id, message) }
      end
    end
    
    autoload :Memory, File.join(ROOT, 'faye', 'engine', 'memory')
    
  end
end

