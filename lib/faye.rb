require 'forwardable'
require 'set'
require 'eventmachine'
require 'json'

module Faye
  VERSION = '0.6.3'
  
  ROOT = File.expand_path(File.dirname(__FILE__))
  
  BAYEUX_VERSION   = '1.0'
  ID_LENGTH        = 128
  JSONP_CALLBACK   = 'jsonpcallback'
  
  MANDATORY_CONNECTION_TYPES = %w[long-polling callback-polling redis tcp in-process]
  
  module Adapter
    autoload :Common, File.join(ROOT, 'faye', 'adapter', 'common')
    autoload :Http,   File.join(ROOT, 'faye', 'adapter', 'http')
    autoload :Tcp,    File.join(ROOT, 'faye', 'adapter', 'tcp')
  end
  
  class RackAdapter
    def self.new(*args)
      warn 'Faye::RackAdapter is deprecated and will be removed in version 0.8. Please use Faye::Adapter::Http instead.'
      Adapter::Http.new(*args)
    end
  end
  
  autoload :FrameParser, File.join(ROOT, 'faye', 'util', 'frame_parser')
  autoload :WebSocket,   File.join(ROOT, 'faye', 'util', 'web_socket')
  
  %w[ mixins/publisher
      mixins/timeouts
      mixins/logging
      util/namespace
      engines/base
      engines/connection
      engines/memory
      engines/redis
      protocol/grammar
      protocol/extensible
      protocol/channel
      protocol/subscription
      protocol/client
      protocol/server
      transport/transport
      transport/local
      transport/http
      transport/redis
      transport/tcp
      error
      
  ].each do |lib|
    require File.join(ROOT, 'faye', lib)
  end
  
  def self.random(bitlength = ID_LENGTH)
    limit    = 2 ** bitlength - 1
    max_size = limit.to_s(36).size
    string   = rand(limit).to_s(36)
    string = '0' + string while string.size < max_size
    string
  end
  
  def self.to_json(value)
    case value
      when Hash, Array then JSON.unparse(value)
      when String, NilClass then value.inspect
      else value.to_s
    end
  end
  
  def self.ensure_reactor_running!
    Thread.new { EM.run } unless EM.reactor_running?
    while not EM.reactor_running?; end
  end
end

