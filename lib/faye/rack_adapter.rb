require 'rubygems'
require 'rack'
require 'json'

module Faye
  class RackAdapter
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
        message  = JSON.parse(request.params['message'])
        jsonp    = request.params['jsonp'] || JSONP_CALLBACK
        type     = request.get? ? TYPE_SCRIPT : TYPE_JSON
        response = nil
        
        @server.process(message, false) do |replies|
          response = JSON.unparse(replies)
          response = "#{ jsonp }(#{ response });" if request.get?
        end
        
        # TODO support Thin's async responses
        sleep(0.1) while response.nil?
        [200, type, [response]]
      
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

