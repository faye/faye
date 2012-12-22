module Faye
  class RackAdapter
    
    include Logging

    extend Forwardable
    def_delegators "@server.engine", :bind, :unbind

    ASYNC_RESPONSE = [-1, {}, []].freeze
    
    DEFAULT_ENDPOINT  = '/bayeux'
    SCRIPT_PATH       = 'faye-browser-min.js'
    
    TYPE_JSON   = {'Content-Type' => 'application/json; charset=utf-8'}
    TYPE_SCRIPT = {'Content-Type' => 'text/javascript; charset=utf-8'}
    TYPE_TEXT   = {'Content-Type' => 'text/plain; charset=utf-8'}
    
    # This header is passed by Rack::Proxy during testing. Rack::Proxy seems to
    # set content-length for you, and setting it in here really slows the tests
    # down. Better suggestions welcome.
    HTTP_X_NO_CONTENT_LENGTH = 'HTTP_X_NO_CONTENT_LENGTH'
    
    def initialize(app = nil, options = nil)
      @app      = app if app.respond_to?(:call)
      @options  = [app, options].grep(Hash).first || {}
      
      @endpoint    = @options[:mount] || DEFAULT_ENDPOINT
      @endpoint_re = Regexp.new('^' + @endpoint + '(/[^/]+)*(\\.[^\\.]+)?$')
      @server      = Server.new(@options)
      
      @static = StaticServer.new(ROOT, /\.(?:js|map)$/)
      @static.map(File.basename(@endpoint) + '.js', SCRIPT_PATH)
      @static.map('client.js', SCRIPT_PATH)
      
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
      Faye::WebSocket.load_adapter('thin')
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
      
      # http://groups.google.com/group/faye-users/browse_thread/thread/4a01bb7d25d3636a
      if env['REQUEST_METHOD'] == 'OPTIONS' or env['HTTP_ACCESS_CONTROL_REQUEST_METHOD'] == 'POST'
        return handle_options(request)
      end
      
      return @static.call(env)        if @static =~ request.path_info
      return handle_websocket(env)    if Faye::WebSocket.websocket?(env)
      return handle_eventsource(env)  if Faye::EventSource.eventsource?(env)
      
      handle_request(request)
    end
    
  private
    
    def handle_request(request)
      unless json_msg = message_from_request(request)
        error 'Received request with no message: ?', format_request(request)
        return [400, TYPE_TEXT, ['Bad request']]
      end
      
      debug "Received message via HTTP #{request.request_method}: ?", json_msg
      
      message  = MultiJson.load(json_msg)
      jsonp    = request.params['jsonp'] || JSONP_CALLBACK
      headers  = request.get? ? TYPE_SCRIPT.dup : TYPE_JSON.dup
      origin   = request.env['HTTP_ORIGIN']
      callback = request.env['async.callback']
      
      @server.flush_connection(message) if request.get?
      
      headers['Access-Control-Allow-Origin'] = origin if origin
      headers['Cache-Control'] = 'no-cache, no-store'
      
      @server.process(message, false) do |replies|
        response = Faye.to_json(replies)
        response = "#{ jsonp }(#{ response });" if request.get?
        headers['Content-Length'] = response.bytesize.to_s unless request.env[HTTP_X_NO_CONTENT_LENGTH]
        headers['Connection'] = 'close'
        debug 'HTTP response: ?', response
        callback.call [200, headers, [response]]
      end
      
      ASYNC_RESPONSE
    rescue => e
      error "#{e.message}\nBacktrace:\n#{e.backtrace * "\n"}"
      [400, TYPE_TEXT, ['Bad request']]
    end
    
    def handle_websocket(env)
      ws        = Faye::WebSocket.new(env, nil, :ping => @options[:ping])
      client_id = nil
      
      ws.onmessage = lambda do |event|
        begin
          debug "Received message via WebSocket[#{ws.version}]: ?", event.data
          
          message   = MultiJson.load(event.data)
          client_id = Faye.client_id_from_messages(message)
          
          @server.open_socket(client_id, ws)
          
          @server.process(message, false) do |replies|
            ws.send(Faye.to_json(replies)) if ws
          end
        rescue => e
          error "#{e.message}\nBacktrace:\n#{e.backtrace * "\n"}"
        end
      end
      
      ws.onclose = lambda do |event|
        @server.close_socket(client_id)
        ws = nil
      end
      
      ws.rack_response
    end
    
    def handle_eventsource(env)
      es        = Faye::EventSource.new(env, :ping => @options[:ping])
      client_id = es.url.split('/').pop
      
      debug 'Opened EventSource connection for ?', client_id
      @server.open_socket(client_id, es)
      
      es.onclose = lambda do |event|
        @server.close_socket(client_id)
        es = nil
      end
      
      es.rack_response
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
    
    def format_request(request)
      request.body.rewind
      string = "curl -X #{request.request_method.upcase}"
      string << " '#{request.url}'"
      if request.post?
        string << " -H 'Content-Type: #{request.env['CONTENT_TYPE']}'" 
        string << " -d '#{request.body.read}'"
      end
      string
    end
    
    def handle_options(request)
      headers = {
        'Access-Control-Allow-Origin'       => '*',
        'Access-Control-Allow-Credentials'  => 'false',
        'Access-Control-Max-Age'            => '86400',
        'Access-Control-Allow-Methods'      => 'POST, GET, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers'      => 'Accept, Content-Type, Pragma, X-Requested-With'
      }
      [200, headers, ['']]
    end
    
  end
end

