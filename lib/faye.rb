require 'forwardable'
require 'set'
require 'rubygems'
require 'eventmachine'
require 'json'

module Faye
  VERSION = '0.3.3'
  
  ROOT = File.expand_path(File.dirname(__FILE__))
  
  BAYEUX_VERSION   = '1.0'
  ID_LENGTH        = 128
  JSONP_CALLBACK   = 'jsonpcallback'
  CONNECTION_TYPES = %w[long-polling callback-polling]
  
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
  
  def self.random(bitlength = ID_LENGTH)
    field  = 2 ** bitlength
    strlen = bitlength / 4
    ("%0#{strlen}s" % rand(field).to_s(16)).gsub(' ', '0')
  end
  
  def self.to_json(value)
    case value
      when Hash, Array then JSON.unparse(value)
      when String, NilClass then value.inspect
      else value.to_s
    end
  end
end

