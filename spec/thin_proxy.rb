require 'rack/proxy'

# This only exists so we can use Rack::Test to test the
# Adapter::Http class, which assumes it's running on Thin

class ThinProxy < Rack::Proxy
  HOST = 'localhost'
  PORT = '8282'
  
  def initialize(rack_app)
    Thin::Logging.silent = true
    handler = Rack::Handler.get('thin')
    
    EM.stop if EM.reactor_running?
    sleep 0.001 while EM.reactor_running?
    
    Thread.new {
      handler.run(rack_app, :Host => HOST, :Port => PORT) do |server|
        @server = server
      end
    }
    sleep 0.001 until EM.reactor_running?
  end
  
  def stop
    EM.stop
    @server.stop
    sleep 0.001 while EM.reactor_running?
  end
  
  def rewrite_env(env)
    env['HTTP_HOST'] = HOST
    env['SERVER_PORT'] = PORT
    env
  end
end
