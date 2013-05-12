class ServerProxy < Rack::Proxy
  HOST = 'localhost'
  PORT = '4180'

  class App
    def initialize(app)
      @app = app
    end

    def listen(port)
      events = Puma::Events.new($stdout, $stderr)
      binder = Puma::Binder.new(events)
      binder.parse(["tcp://0.0.0.0:#{PORT}"], self)

      @server = Puma::Server.new(self, events)
      @server.binder = binder
      @thread = @server.run
    rescue => e
    end

    def stop
      @server.stop
      @thread.join
    end

    def call(env)
      @app.call(env)
    end

    def log(message)
    end
  end

  def initialize(rack_app)
    @app = App.new(rack_app)
    @app.listen(PORT)
  end

  def stop
    @app.stop
  end

  def rewrite_env(env)
    env['HTTP_HOST'] = HOST
    env['SERVER_PORT'] = PORT
    env[Faye::RackAdapter::HTTP_X_NO_CONTENT_LENGTH] = '1'
    env
  end
end
