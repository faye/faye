require 'forwardable'
require 'set'
require 'eventmachine'
require 'json'

module Faye
  VERSION = '0.6.5'
  
  ROOT = File.expand_path(File.dirname(__FILE__))
  
  BAYEUX_VERSION   = '1.0'
  ID_LENGTH        = 128
  JSONP_CALLBACK   = 'jsonpcallback'
  CONNECTION_TYPES = %w[long-polling cross-origin-long-polling callback-polling websocket in-process]
  
  MANDATORY_CONNECTION_TYPES = %w[long-polling callback-polling in-process]
  
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
      error
      
  ].each do |lib|
    require File.join(ROOT, 'faye', lib)
  end
  
  autoload :RackAdapter, File.join(ROOT, 'faye', 'adapters', 'rack_adapter')
  autoload :WebSocket, File.join(ROOT, 'faye', 'util', 'web_socket')
  
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
  
  def self.encode(string, encoding = 'UTF-8')
    return string unless string.respond_to?(:force_encoding)
    string.force_encoding(encoding)
  end
  
  def self.ensure_reactor_running!
    Thread.new { EM.run } unless EM.reactor_running?
    while not EM.reactor_running?; end
  end
  
  def self.async_each(list, iterator, callback)
    n       = list.size
    i       = -1
    calls   = 0
    looping = false
    
    loop, resume = nil, nil
    
    iterate = lambda do
      calls -= 1
      i += 1
      if i == n
        callback.call if callback
      else
        iterator.call(list[i], resume)
      end
    end
    
    loop = lambda do
      unless looping
        looping = true
        iterate.call while calls > 0
        looping = false
      end
    end
    
    resume = lambda do
      calls += 1
      loop.call
    end
    resume.call
  end
end

