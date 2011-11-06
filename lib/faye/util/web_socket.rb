module Faye
  class WebSocket
    
    root = File.expand_path('..', __FILE__) + '/web_socket'
    
    autoload :API,             root + '/api'
    autoload :Client,          root + '/client'
    autoload :Draft75Parser,   root + '/draft75_parser'
    autoload :Draft76Parser,   root + '/draft76_parser'
    autoload :Protocol8Parser, root + '/protocol8_parser'
    
    attr_reader :env
    include API
    
    extend Forwardable
    def_delegators :@parser, :version
    
    def self.parser(env)
      if env['HTTP_SEC_WEBSOCKET_VERSION']
        Protocol8Parser
      elsif env['HTTP_SEC_WEBSOCKET_KEY1']
        Draft76Parser
      else
        Draft75Parser
      end
    end
    
    def initialize(env)
      @env      = env
      @callback = @env['async.callback']
      @stream   = Stream.new(@env['em.connection'])
      @callback.call [200, RackAdapter::TYPE_JSON, @stream]
      
      @url = determine_url
      @ready_state = CONNECTING
      @buffered_amount = 0
      
      @parser = WebSocket.parser(@env).new(self)
      @stream.write(@parser.handshake_response)
      
      @ready_state = OPEN
      
      event = Event.new('open')
      event.init_event('open', false, false)
      dispatch_event(event)
      
      @env[Thin::Request::WEBSOCKET_RECEIVE_CALLBACK] = @parser.method(:parse)
    end
    
  private
    
    def determine_url
      secure = if @env.has_key?('HTTP_X_FORWARDED_PROTO')
                 @env['HTTP_X_FORWARDED_PROTO'] == 'https'
               else
                 @env['HTTP_ORIGIN'] =~ /^https:/i
               end
      
      scheme = secure ? 'wss:' : 'ws:'
      "#{ scheme }//#{ @env['HTTP_HOST'] }#{ @env['REQUEST_URI'] }"
    end
  end
  
  class WebSocket::Stream
    include EventMachine::Deferrable
    
    extend Forwardable
    def_delegators :@connection, :close_connection, :close_connection_after_writing
    
    def initialize(connection)
      @connection = connection
    end
    
    def each(&callback)
      @data_callback = callback
    end
    
    def write(data)
      return unless @data_callback
      @data_callback.call(data)
    end
  end
  
end
