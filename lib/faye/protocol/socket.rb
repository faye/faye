module Faye
  class Server

    class Socket
      def initialize(server, socket, env)
        @server = server
        @socket = socket
        @env    = env
      end

      def send(message)
        @server.pipe_through_extensions(:outgoing, message, @env) do |piped_message|
          @socket.send(Faye.to_json([piped_message])) if @socket
        end
      end

      def close
        @socket.close if @socket
        @socket = nil
      end
    end

  end
end
