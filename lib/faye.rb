require 'cgi'
require 'cookiejar'
require 'digest/sha1'
require 'em-http'
require 'em-http/version'
require 'eventmachine'
require 'faye/websocket'
require 'forwardable'
require 'json'
require 'rack'
require 'set'
require 'time'
require 'uri'

module Faye
  VERSION = '0.7.0'
  
  ROOT = File.expand_path(File.dirname(__FILE__))
  
  autoload :Publisher,    File.join(ROOT, 'faye', 'mixins', 'publisher')
  autoload :Timeouts,     File.join(ROOT, 'faye', 'mixins', 'timeouts')
  autoload :Logging,      File.join(ROOT, 'faye', 'mixins', 'logging')
  
  autoload :Namespace,    File.join(ROOT, 'faye', 'util', 'namespace')
  
  autoload :Engine,       File.join(ROOT, 'faye', 'engines', 'base')
  
  autoload :Grammar,      File.join(ROOT, 'faye', 'protocol', 'grammar')
  autoload :Extensible,   File.join(ROOT, 'faye', 'protocol', 'extensible')
  autoload :Channel,      File.join(ROOT, 'faye', 'protocol', 'channel')
  autoload :Subscription, File.join(ROOT, 'faye', 'protocol', 'subscription')
  autoload :Publication,  File.join(ROOT, 'faye', 'protocol', 'publication')
  autoload :Client,       File.join(ROOT, 'faye', 'protocol', 'client')
  autoload :Server,       File.join(ROOT, 'faye', 'protocol', 'server')
  
  autoload :Transport,    File.join(ROOT, 'faye', 'transport', 'transport')
  autoload :Error,        File.join(ROOT, 'faye', 'error')
  
  autoload :RackAdapter,  File.join(ROOT, 'faye', 'adapters', 'rack_adapter')
  
  BAYEUX_VERSION   = '1.0'
  ID_LENGTH        = 128
  JSONP_CALLBACK   = 'jsonpcallback'
  CONNECTION_TYPES = %w[long-polling cross-origin-long-polling callback-polling websocket in-process]
  
  MANDATORY_CONNECTION_TYPES = %w[long-polling callback-polling in-process]
  
  def self.ensure_reactor_running!
    Thread.new { EM.run } unless EM.reactor_running?
    while not EM.reactor_running?; end
  end
  
  def self.random(bitlength = ID_LENGTH)
    limit    = 2 ** bitlength - 1
    max_size = limit.to_s(36).size
    string   = rand(limit).to_s(36)
    string = '0' + string while string.size < max_size
    string
  end
  
  def self.copy_object(object)
    Marshal.load(Marshal.dump(object))
  end
  
  def self.to_json(value)
    case value
      when Hash, Array then JSON.unparse(value)
      when String, NilClass then value.inspect
      else value.to_s
    end
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

