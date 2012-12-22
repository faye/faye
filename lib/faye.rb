require 'cgi'
require 'cookiejar'
require 'digest/sha1'
require 'em-http'
require 'em-http/version'
require 'eventmachine'
require 'faye/websocket'
require 'forwardable'
require 'rack'
require 'set'
require 'time'
require 'uri'
require 'multi_json'

module Faye
  VERSION = '0.8.6'
  
  ROOT = File.expand_path(File.dirname(__FILE__))
  
  autoload :Publisher,    File.join(ROOT, 'faye', 'mixins', 'publisher')
  autoload :Timeouts,     File.join(ROOT, 'faye', 'mixins', 'timeouts')
  autoload :Logging,      File.join(ROOT, 'faye', 'mixins', 'logging')
  
  autoload :Namespace,    File.join(ROOT, 'faye', 'util', 'namespace')
  
  autoload :Engine,       File.join(ROOT, 'faye', 'engines', 'proxy')
  
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
  autoload :StaticServer, File.join(ROOT, 'faye', 'adapters', 'static_server')
  
  BAYEUX_VERSION   = '1.0'
  JSONP_CALLBACK   = 'jsonpcallback'
  CONNECTION_TYPES = %w[long-polling cross-origin-long-polling callback-polling websocket eventsource in-process]
  
  MANDATORY_CONNECTION_TYPES = %w[long-polling callback-polling in-process]
  
  class << self
    attr_accessor :logger
  end
  self.logger = method(:puts)
  
  def self.ensure_reactor_running!
    Engine.ensure_reactor_running!
  end
  
  def self.random(*args)
    Engine.random(*args)
  end
  
  def self.client_id_from_messages(messages)
    first = [messages].flatten.first
    first && first['clientId']
  end
  
  def self.copy_object(object)
    case object
    when Hash
      clone = {}
      object.each { |k,v| clone[k] = copy_object(v) }
      clone
    when Array
      clone = []
      object.each { |v| clone << copy_object(v) }
      clone
    else
      object
    end
  end
  
  def self.to_json(value)
    case value
      when Hash, Array then MultiJson.dump(value)
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

