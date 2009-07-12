require 'net/http'
require 'cgi'

module Faye
  class Proxy
    
    def initialize(app = nil, options = nil)
      @app     = app if app.respond_to?(:call)
      @options = [app, options].grep(Hash).first || {}
      
      @host   = @options[:host]  || DAEMON_HOST
      @port   = @options[:port]  || DAEMON_PORT
      @mount  = @options[:mount] || RackAdapter::DEFAULT_ENDPOINT
      @script = @mount + '.js'
      
      @endpoint = "http://#{ @host }:#{ @port }#{ RackAdapter::DEFAULT_ENDPOINT }"
    end
    
    def call(env)
      request = Rack::Request.new(env)
      case request.path_info
      
      when @mount then
        message = request.params['message']
        if request.get?
          puts "WOOOOOO"
        else
          response = Net::HTTP.post_form(URI.parse(@endpoint), 'message' => message)
          headers  = RackAdapter::TYPE_JSON
        end
        [response.code.to_i, headers, [response.body]]
      
      when @script then
        response = Net::HTTP.get_response(URI.parse(@endpoint + '.js'))
        headers  = RackAdapter::TYPE_SCRIPT
        [response.code.to_i, headers, [response.body]]
      
      else
        @app ? @app.call(env) : [404, TYPE_TEXT, ["404"]]
      end
    end
    
  end
end

