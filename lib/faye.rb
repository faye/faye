require 'forwardable'
require 'set'
require 'rubygems'
require 'eventmachine'
require 'json'

module Faye
  VERSION = '0.3.4'
  
  ROOT = File.expand_path(File.dirname(__FILE__))
  
  BAYEUX_VERSION   = '1.0'
  ID_LENGTH        = 128
  JSONP_CALLBACK   = 'jsonpcallback'
  CONNECTION_TYPES = %w[long-polling callback-polling websocket]
  
  MANDATORY_CONNECTION_TYPES = %w[long-polling callback-polling in-process]
  
  %w[ mixins/publisher
      mixins/timeouts
      mixins/logging
      util/namespace
      protocol/grammar
      protocol/extensible
      protocol/channel
      protocol/subscription
      protocol/client
      protocol/server
      protocol/connection
      network/transport
      error
      
  ].each do |lib|
    require File.join(ROOT, 'faye', lib)
  end
  
  autoload :RackAdapter, File.join(ROOT, 'faye', 'adapters', 'rack_adapter')
  autoload :WebSocket, File.join(ROOT, 'faye', 'util', 'web_socket')
  
  def self.random(bitlength = ID_LENGTH)
    rand(2 ** bitlength).to_s(36)
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

