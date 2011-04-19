require 'rubygems'
require 'json'
require 'rack'
require 'thin'
require Faye::ROOT + '/thin_extensions'

module Faye
  class RackAdapter
    
    # Only supported under Thin
    ASYNC_RESPONSE = [-1, {}, []].freeze
    
    DEFAULT_ENDPOINT  = '/bayeux'
    SCRIPT_PATH       = File.join(ROOT, 'faye-browser-min.js')
    
    TYPE_JSON   = {'Content-Type' => 'application/json'}
    TYPE_SCRIPT = {'Content-Type' => 'text/javascript'}
    TYPE_TEXT   = {'Content-Type' => 'text/plain'}
    
    def initialize(app = nil, options = nil)
      @app      = app if app.respond_to?(:call)
      @options  = [app, options].grep(Hash).first || {}
      
      @endpoint    = @options[:mount] || DEFAULT_ENDPOINT
      @endpoint_re = Regexp.new('^' + @endpoint + '(/[^/]*)*(\\.js)?$')
      @server      = Server.new(@options)
      
      return unless extensions = @options[:extensions]
      [*extensions].each { |extension| add_extension(extension) }
    end
    
    def add_extension(extension)
      @server.add_extension(extension)
    end
    
    def remove_extension(extension)
      @server.remove_extension(extension)
    end
    
    def get_client
      @client ||= Client.new(@server)
    end
    
    def listen(port)
      handler = Rack::Handler.get('thin')
      handler.run(self, :Port => port)
    end
    
    def call(env)
      Faye.ensure_reactor_running!
      request = Rack::Request.new(env)
      
      unless request.path_info =~ @endpoint_re
        return @app ? @app.call(env) :
                      [404, TYPE_TEXT, ["Sure you're not looking for #{@endpoint} ?"]]
      end
      
      if env['HTTP_UPGRADE'] == 'WebSocket'
        return handle_upgrade(request)
      end
      
      if request.path_info =~ /\.js$/
        return [200, TYPE_SCRIPT, File.new(SCRIPT_PATH)]
      end
      
      begin
        json_msg = message_from_request(request)
        message  = JSON.parse(json_msg)
        jsonp    = request.params['jsonp'] || JSONP_CALLBACK
        head     = request.get? ? TYPE_SCRIPT.dup : TYPE_JSON.dup
        origin   = request.env['HTTP_ORIGIN']
        callback = env['async.callback']
        body     = DeferredBody.new
        
        @server.flush_connection(message) if request.get?
        
        head['Access-Control-Allow-Origin'] = origin if origin
        callback.call [200, head, body]
        
        @server.process(message, false) do |replies|
          response = JSON.unparse(replies)
          response = "#{ jsonp }(#{ response });" if request.get?
          body.succeed(response)
        end
        
        ASYNC_RESPONSE
        
      rescue
        [400, TYPE_TEXT, ['Bad request']]
      end
    end
    
  private
    
    def message_from_request(request)
      if request.post?
        content_type = request.env['CONTENT_TYPE'].split(';').first
        content_type == 'application/json' ?
            request.body.read :
            request.params['message']
      else
        request.params['message']
      end
    end
    
    def handle_upgrade(request)
      socket = Faye::WebSocket.new(request)
      
      socket.onmessage = lambda do |message|
        begin
          message = JSON.parse(message.data)
          @server.process(message, false) do |replies|
            socket.send(JSON.unparse(replies))
          end
        rescue
        end
      end
      ASYNC_RESPONSE
    end
    
    class DeferredBody
      include EventMachine::Deferrable
      alias :each :callback
    end
    
  end
end

