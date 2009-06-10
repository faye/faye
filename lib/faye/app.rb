require 'rubygems'
require 'rack'

module Faye
  class App
    DEFAULT_ENDPOINT  = '/bayeux'
    
    TYPE_JSON   = {'Content-Type' => 'text/json'}
    TYPE_SCRIPT = {'Content-Type' => 'text/javascript'}
    TYPE_TEXT   = {'Content-Type' => 'text/plain'}
    
    def initialize(app = nil, options = nil)
      @app      = app if app.respond_to?(:call)
      @options  = [app, options].grep(Hash).first || {}
      
      @endpoint = @options[:mount] || DEFAULT_ENDPOINT
      @script   = @endpoint + '.js'
      @server   = Server.new
    end
    
    def call(env)
      request = Rack::Request.new(env)
      case request.path_info
      
      when @endpoint then
        args = [ request.params['message'] ]
        args << {:jsonp => request.params['jsonp']} if request.get?
        puts args.inspect
        response = @server.process(*args)
        [200, TYPE_JSON, [response]]
      
      when @script then
        [200, TYPE_SCRIPT, File.new(CLIENT_SCRIPT)]
      
      else
        env['faye.server'] = @server
        @app ? @app.call(env) :
               [404, TYPE_TEXT, ["Sure you're not looking for #{@endpoint} ?"]]
      end
    end
    
  end
end

