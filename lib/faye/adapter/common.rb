module Faye
  module Adapter
    
    module Common
      def add_extension(extension)
        @server.add_extension(extension)
      end
      
      def remove_extension(extension)
        @server.remove_extension(extension)
      end
      
      def get_client
        @client ||= Client.new(@server)
      end
    end
    
  end
end
