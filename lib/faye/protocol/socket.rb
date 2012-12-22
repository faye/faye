module Faye
  class Server

    class Socket
      def initialize(server, socket)
        @server = server
        @socket = socket
      end

      def send(message)
        @server.pipe_through_extensions(:outgoing, message) do |piped_message|
          @socket.send(Faye.to_json([piped_message]))
        end
      end

      def close
        @socket.close
      end
    end

  end
end

