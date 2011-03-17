module Faye
  module Engine
    def self.register(type, klass)
      @backends ||= {}
      @backends[type] = klass
    end
    
    def self.get(options)
      klass = @backends[options[:engine]] || Memory
      klass.new(options)
    end
    
    class Base
      include Publisher
      include Timeouts
      
      def initialize(options)
        @options = options
      end
      
      def announce(client_ids, message)
        client_ids.each do |client_id|
          publish_event(:message, client_id, message)
        end
      end
    end
  end
end

