module Faye
  class RackAdapter
    
    include Logging

    extend Forwardable
    def_delegators "@server.engine", :bind, :unbind

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
    
    def listen(port, ssl_options = nil)
      handler = Rack::Handler.get('thin')
      handler.run(self, :Port => port) do |s|
        if ssl_options
          s.ssl = true
          s.ssl_options = {
            :private_key_file => ssl_options[:key],
            :cert_chain_file  => ssl_options[:cert]
          }
        end
        @thin_server = s
      end
    end
    
    def stop
      return unless @thin_server
      @thin_server.stop
      @thin_server = nil
    end
    
    def call(env)
      Faye.ensure_reactor_running!
      request = Rack::Request.new(env)
      
      unless request.path_info =~ @endpoint_re
        env['faye.client'] = get_client
        return @app ? @app.call(env) :
                      [404, TYPE_TEXT, ["Sure you're not looking for #{@endpoint} ?"]]
      end
      
      return serve_client_script(env) if request.path_info =~ /\.js$/
      return handle_options(request)  if env['REQUEST_METHOD'] == 'OPTIONS'
      return handle_upgrade(request)  if env['HTTP_UPGRADE'] =~ /^WebSocket$/i
      
      handle_request(request)
    end
    
  private
    
    def serve_client_script(env)
      @client_script ||= File.read(SCRIPT_PATH)
      @client_digest ||= Digest::SHA1.hexdigest(@client_script)
      @client_mtime  ||= File.mtime(SCRIPT_PATH)
      
      headers = TYPE_SCRIPT.dup
      ims     = env['HTTP_IF_MODIFIED_SINCE']
      
      headers['ETag'] = @client_digest
      headers['Last-Modified'] = @client_mtime.httpdate
      
      if env['HTTP_IF_NONE_MATCH'] == @client_digest
        [304, headers, ['']]
      elsif ims and @client_mtime <= Time.httpdate(ims)
        [304, headers, ['']]
      else
        [200, headers, [@client_script]]
      end
    end
    
    def handle_request(request)
      json_msg = message_from_request(request)
      message  = JSON.parse(json_msg)
      jsonp    = request.params['jsonp'] || JSONP_CALLBACK
      headers  = request.get? ? TYPE_SCRIPT.dup : TYPE_JSON.dup
      origin   = request.env['HTTP_ORIGIN']
      callback = request.env['async.callback']
      body     = DeferredBody.new
      
      debug 'Received ?: ?', request.env['REQUEST_METHOD'], json_msg
      @server.flush_connection(message) if request.get?
      
      headers['Access-Control-Allow-Origin'] = origin if origin
      headers['Cache-Control'] = 'no-cache, no-store' if request.get?
      callback.call [200, headers, body]
      
      @server.process(message, false) do |replies|
        response = JSON.unparse(replies)
        response = "#{ jsonp }(#{ response });" if request.get?
        debug 'Returning ?', response
        body.succeed(response)
      end
      
      ASYNC_RESPONSE
    rescue
      [400, TYPE_TEXT, ['Bad request']]
    end
    
    def handle_upgrade(request)
      socket = Faye::WebSocket.new(request.env)
      
      socket.onmessage = lambda do |message|
        begin
          message = JSON.parse(message.data)
          debug "Received via WebSocket[#{socket.version}]: ?", message
          @server.process(message, false) do |replies|
            debug "Sending via WebSocket[#{socket.version}]: ?", replies
            socket.send(JSON.unparse(replies))
          end
        rescue
        end
      end
      ASYNC_RESPONSE
    end
    
    def message_from_request(request)
      message = request.params['message']
      return message if message
      
      # Some clients do not send a content-type, e.g.
      # Internet Explorer when using cross-origin-long-polling
      # Some use application/xml when using CORS
      content_type = request.env['CONTENT_TYPE'] || ''
      
      if content_type.split(';').first == 'application/json'
        request.body.read
      else
        CGI.parse(request.body.read)['message'][0]
      end
    end
    
    def handle_options(request)
      headers = {
        'Access-Control-Allow-Origin'       => '*',
        'Access-Control-Allow-Credentials'  => 'false',
        'Access-Control-Max-Age'            => '86400',
        'Access-Control-Allow-Methods'      => 'POST, GET, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers'      => 'Accept, Content-Type, X-Requested-With'
      }
      [200, headers, ['']]
    end
    
    class DeferredBody
      include EventMachine::Deferrable
      alias :each :callback
    end
    
  end
end

