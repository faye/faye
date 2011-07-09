module Faye
  module Adapter
    
    module Common
      extend Forwardable
      def_delegators :@server, :engine,
                               :add_extension,
                               :remove_extension
      
      def get_client
        @client ||= Client.new(@server)
      end
    end
    
  end
end
