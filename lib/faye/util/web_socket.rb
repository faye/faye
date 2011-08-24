module Faye
  class WebSocket
    
    root = File.expand_path('..', __FILE__) + '/web_socket'
    
    autoload :API,             root + '/api'
    autoload :Client,          root + '/client'
    autoload :Draft75Parser,   root + '/draft75_parser'
    autoload :Draft76Parser,   root + '/draft76_parser'
    autoload :Protocol8Parser, root + '/protocol8_parser'
    
    include API
    
    CONNECTING = 0
    OPEN       = 1
    CLOSING    = 2
    CLOSED     = 3
    
    extend Forwardable
    def_delegators :@parser, :version
    
    def self.parser(request)
      if request.env['HTTP_SEC_WEBSOCKET_VERSION']
        Protocol8Parser
      elsif request.env['HTTP_SEC_WEBSOCKET_KEY1']
        Draft76Parser
      else
        Draft75Parser
      end
    end
    
    def initialize(request)
      @request  = request
      @callback = @request.env['async.callback']
      @stream   = Stream.new
      @callback.call [200, RackAdapter::TYPE_JSON, @stream]
      
      @url = @request.env['websocket.url']
      @ready_state = OPEN
      
      event = Event.new
      event.init_event('open', false, false)
      dispatch_event(event)
      
      @parser = WebSocket.parser(@request).new(self)
      @request.env[Thin::Request::WEBSOCKET_RECEIVE_CALLBACK] = @parser.method(:parse)
    end
  end
  
  class WebSocket::Stream
    include EventMachine::Deferrable
    
    def each(&callback)
      @data_callback = callback
    end
    
    def write(data)
      return unless @data_callback
      @data_callback.call(data)
    end
  end
  
end
