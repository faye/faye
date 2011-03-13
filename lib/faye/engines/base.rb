module Faye
  module Engine
    def self.get(type, options)
      Memory.new(options)
    end
    
    class Base
      include Publisher
      include Timeouts
      
      def initialize(options)
        @options = options
      end
      
      def announce(client_id, message)
        publish_event(:message, client_id, message)
      end
    end
  end
end

