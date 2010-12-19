module Faye
  module Engine
    
    class Base
      include Timeouts
      
      def initialize(options = {})
        @options   = options
        @listeners = []
      end
      
      def on_message(&block)
        @listeners << block
      end
      
      def announce(client_id, message)
        @listeners.each { |block| block.call(client_id, message) }
      end
      
      def method_missing(key)
        @options[key.to_sym]
      end
    end
    
    autoload :Memory, File.join(ROOT, 'faye', 'engine', 'memory')
    
  end
end

