module Faye
  class RackAdapter

    include Logging

    extend Forwardable
    def_delegators '@server.engine', *Faye::Publisher.instance_methods

    ASYNC_RESPONSE = [-1, {}, []].freeze

    DEFAULT_ENDPOINT  = '/bayeux'
    SCRIPT_PATH       = 'faye-browser-min.js'

    TYPE_JSON   = {'Content-Type' => 'application/json; charset=utf-8'}
    TYPE_SCRIPT = {'Content-Type' => 'text/javascript; charset=utf-8'}
    TYPE_TEXT   = {'Content-Type' => 'text/plain; charset=utf-8'}

    VALID_JSONP_CALLBACK = /^[a-z_\$][a-z0-9_\$]*(\.[a-z_\$][a-z0-9_\$]*)*$/i

    # This header is passed by Rack::Proxy during testing. Rack::Proxy seems to
    # set content-length for you, and setting it in here really slows the tests
    # down. Better suggestions welcome.
    HTTP_X_NO_CONTENT_LENGTH = 'HTTP_X_NO_CONTENT_LENGTH'

    def initialize(app = nil, options = nil, &block)
      @app     = app if app.respond_to?(:call)
      @options = [app, options].grep(Hash).first || {}

      ::WebSocket::Driver.validate_options(@options, [:engine, :mount, :ping, :timeout, :extensions, :websocket_extensions])

      @endpoint    = @options[:mount] || DEFAULT_ENDPOINT
      @extensions  = []
      @endpoint_re = Regexp.new('^' + @endpoint.gsub(/\/$/, '') + '(/[^/]*)*(\\.[^\\.]+)?$')
      @server      = Server.new(@options)

      @static = StaticServer.new(ROOT, /\.(?:js|map)$/)
      @static.map(File.basename(@endpoint) + '.js', SCRIPT_PATH)
      @static.map('client.js', SCRIPT_PATH)

      if extensions = @options[:extensions]
        [*extensions].each { |extension| add_extension(extension) }
      end

      if websocket_extensions = @options[:websocket_extensions]
        [*websocket_extensions].each { |ext| add_websocket_extension(ext) }
      end

      block.call(self) if block
    end

    def listen(*args)
      raise 'The listen() method is deprecated - see https://github.com/faye/faye-websocket-ruby#running-your-socket-application for information on running your Faye server'
    end

    def add_extension(extension)
      @server.add_extension(extension)
    end

    def remove_extension(extension)
      @server.remove_extension(extension)
    end

    def add_websocket_extension(extension)
      @extensions << extension
    end

    def close
      @server.close
    end

    def get_client
      @client ||= Client.new(@server)
    end

    def call(env)
      Faye.ensure_reactor_running!
      request = Rack::Request.new(env)

      unless request.path_info =~ @endpoint_re
        env['faye.client'] = get_client
        return @app ? @app.call(env) :
                      [404, TYPE_TEXT, ["Sure you're not looking for #{@endpoint} ?"]]
      end

      return @static.call(env) if @static =~ request.path_info

      # http://groups.google.com/group/faye-users/browse_thread/thread/4a01bb7d25d3636a
      if env['REQUEST_METHOD'] == 'OPTIONS' or env['HTTP_ACCESS_CONTROL_REQUEST_METHOD'] == 'POST'
        return handle_options
      end

      return handle_websocket(request)   if Faye::WebSocket.websocket?(env)
      return handle_eventsource(request) if Faye::EventSource.eventsource?(env)

      handle_request(request)
    end

  private

    def handle_request(request)
      unless json_msg = message_from_request(request)
        error 'Received request with no message: ?', format_request(request)
        return [400, TYPE_TEXT, ['Bad request']]
      end

      unless json_msg.force_encoding('UTF-8').valid_encoding?
        error 'Received request with invalid encoding: ?', format_request(request)
        return [400, TYPE_TEXT, ['Bad request']]
      end

      debug("Received message via HTTP #{request.request_method}: ?", json_msg)

      message  = MultiJson.load(json_msg)
      jsonp    = request.params['jsonp'] || JSONP_CALLBACK
      headers  = request.get? ? TYPE_SCRIPT.dup : TYPE_JSON.dup
      origin   = request.env['HTTP_ORIGIN']
      callback = request.env['async.callback']

      if jsonp !~ VALID_JSONP_CALLBACK
        error 'Invalid JSON-P callback: ?', jsonp
        return [400, TYPE_TEXT, ['Bad request']]
      end

      headers['Access-Control-Allow-Origin'] = origin if origin
      headers['Cache-Control'] = 'no-cache, no-store'
      headers['X-Content-Type-Options'] = 'nosniff'

      request.env['rack.hijack'].call if request.env['rack.hijack']
      hijack = request.env['rack.hijack_io']

      EventMachine.next_tick do
        @server.process(message, request) do |replies|
          response = Faye.to_json(replies)

          if request.get?
            response = "/**/#{ jsonp }(#{ jsonp_escape(response) });"
            headers['Content-Disposition'] = 'attachment; filename=f.txt'
          end

          headers['Content-Length'] = response.bytesize.to_s unless request.env[HTTP_X_NO_CONTENT_LENGTH]
          headers['Connection'] = 'close'
          debug('HTTP response: ?', response)
          send_response([200, headers, [response]], hijack, callback)
        end
      end

      ASYNC_RESPONSE
    rescue => e
      error "#{e.message}\nBacktrace:\n#{e.backtrace * "\n"}"
      [400, TYPE_TEXT, ['Bad request']]
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

    def jsonp_escape(json)
      json.gsub(/\u2028/, '\u2028').gsub(/\u2029/, '\u2029')
    end

    def send_response(response, hijack, callback)
      return callback.call(response) if callback

      buffer = "HTTP/1.1 #{response[0]} OK\r\n"
      response[1].each do |name, value|
        buffer << "#{name}: #{value}\r\n"
      end
      buffer << "\r\n"
      response[2].each do |chunk|
        buffer << chunk
      end

      hijack.write(buffer)
      hijack.flush
      hijack.close_write
    end

    def handle_websocket(request)
      options   = {:extensions => @extensions, :ping => @options[:ping]}
      ws        = Faye::WebSocket.new(request.env, [], options)
      client_id = nil

      ws.onmessage = lambda do |event|
        begin
          debug("Received message via WebSocket[#{ws.version}]: ?", event.data)

          message = MultiJson.load(event.data)
          cid     = Faye.client_id_from_messages(message)

          @server.close_socket(client_id, false) if client_id and cid and cid != client_id
          @server.open_socket(cid, ws, request)
          client_id = cid if cid

          @server.process(message, request) do |replies|
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

    def handle_eventsource(request)
      es        = Faye::EventSource.new(request.env, :ping => @options[:ping])
      client_id = es.url.split('/').pop

      debug('Opened EventSource connection for ?', client_id)
      @server.open_socket(client_id, es, request)

      es.onclose = lambda do |event|
        @server.close_socket(client_id)
        es = nil
      end

      es.rack_response
    end

    def handle_options
      headers = {
        'Access-Control-Allow-Credentials' => 'false',
        'Access-Control-Allow-Headers'     => 'Accept, Content-Type, Pragma, X-Requested-With',
        'Access-Control-Allow-Methods'     => 'POST, GET, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Origin'      => '*',
        'Access-Control-Max-Age'           => '86400'
      }
      [200, headers, []]
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

  end
end
