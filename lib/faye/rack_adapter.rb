require 'rubygems'
require 'rack'
require 'json'

module Faye
  class RackAdapter
    
    # Only supported under Thin
    ASYNC_RESPONSE = [-1, {}, []].freeze
    
    DEFAULT_ENDPOINT  = '/bayeux'
    
    TYPE_JSON   = {'Content-Type' => 'text/json'}
    TYPE_SCRIPT = {'Content-Type' => 'text/javascript'}
    TYPE_TEXT   = {'Content-Type' => 'text/plain'}
    
    def initialize(app = nil, options = nil)
      @app      = app if app.respond_to?(:call)
      @options  = [app, options].grep(Hash).first || {}
      
      @endpoint = @options[:mount] || DEFAULT_ENDPOINT
      @script   = @endpoint + '.js'
      @server   = Server.new(@options)
    end
    
    def get_client
      @client ||= Client.new(@server)
    end
    
    def run(port)
      handler = Rack::Handler.get('thin')
      handler.run(self, :Port => port)
    end
    
    def call(env)
      request = Rack::Request.new(env)
      case request.path_info
      
      when @endpoint then
        begin
          message  = JSON.parse(request.params['message'])
          jsonp    = request.params['jsonp'] || JSONP_CALLBACK
          
          @server.flush_connection(message) if request.get?
          
          on_response(env, message) do |replies|
            response = JSON.unparse(replies)
            response = "#{ jsonp }(#{ response });" if request.get?
            response
          end
        rescue
          [400, TYPE_TEXT, 'Bad request']
        end
      
      when @script then
        [200, TYPE_SCRIPT, File.new(CLIENT_SCRIPT)]
      
      else
        env['faye.server'] = @server
        @app ? @app.call(env) :
               [404, TYPE_TEXT, ["Sure you're not looking for #{@endpoint} ?"]]
      end
    end
    
  private
    
    def on_response(env, message, &block)
      request  = Rack::Request.new(env)
      type     = request.get? ? TYPE_SCRIPT : TYPE_JSON
      callback = env['async.callback']
      
      EM.run unless EM.reactor_running?
      
      if callback
        body = DeferredBody.new
        callback.call [200, type, body]
        @server.process(message, false) { |r| body.succeed block.call(r) }
        return ASYNC_RESPONSE
      end
      
      response = nil
      @server.process(message, false) { |r| response = block.call(r) }
      sleep(0.1) while response.nil?
      [200, type, [response]]
    end
    
    class DeferredBody
      include EventMachine::Deferrable
      alias :each :callback
    end
    
  end
end

