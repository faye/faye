require 'rack/proxy'

# This only exists so we can use Rack::Test to test the
# RackAdapter class, which assumes it's running on Thin

class ThinProxy < Rack::Proxy
  HOST = 'localhost'
  PORT = '8282'

  def initialize(rack_app)
    Thin::Logging.silent = true
    handler = Rack::Handler.get('thin')

    EM.stop if EM.reactor_running?
    Thread.pass while EM.reactor_running?

    Thread.new {
      handler.run(rack_app, :Host => HOST, :Port => PORT) do |server|
        @server = server
      end
    }
    Thread.pass until EM.reactor_running?
  end

  def stop
    EM.stop
    @server.stop
    Thread.pass while EM.reactor_running?
  end

  def rewrite_env(env)
    env['HTTP_HOST'] = HOST
    env['SERVER_PORT'] = PORT
    env[Faye::RackAdapter::HTTP_X_NO_CONTENT_LENGTH] = '1'
    env
  end
end
