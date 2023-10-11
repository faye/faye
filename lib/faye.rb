require 'cgi'
require 'cookiejar'
require 'digest/sha1'
require 'em-http'
require 'em-http/version'
require 'eventmachine'
require 'faye/websocket'
require 'forwardable'
require 'multi_json'
require 'rack'
require 'securerandom'
require 'set'
require 'time'
require 'uri'

module Faye
  VERSION = '1.4.0'

  ROOT = File.expand_path(File.dirname(__FILE__))

  autoload :Deferrable,   File.join(ROOT, 'faye', 'mixins', 'deferrable')
  autoload :Logging,      File.join(ROOT, 'faye', 'mixins', 'logging')
  autoload :Publisher,    File.join(ROOT, 'faye', 'mixins', 'publisher')
  autoload :Timeouts,     File.join(ROOT, 'faye', 'mixins', 'timeouts')

  autoload :Namespace,    File.join(ROOT, 'faye', 'util', 'namespace')

  autoload :Engine,       File.join(ROOT, 'faye', 'engines', 'proxy')

  autoload :Channel,      File.join(ROOT, 'faye', 'protocol', 'channel')
  autoload :Client,       File.join(ROOT, 'faye', 'protocol', 'client')
  autoload :Dispatcher,   File.join(ROOT, 'faye', 'protocol', 'dispatcher')
  autoload :Scheduler,    File.join(ROOT, 'faye', 'protocol', 'scheduler')
  autoload :Extensible,   File.join(ROOT, 'faye', 'protocol', 'extensible')
  autoload :Grammar,      File.join(ROOT, 'faye', 'protocol', 'grammar')
  autoload :Publication,  File.join(ROOT, 'faye', 'protocol', 'publication')
  autoload :Server,       File.join(ROOT, 'faye', 'protocol', 'server')
  autoload :Subscription, File.join(ROOT, 'faye', 'protocol', 'subscription')

  autoload :Error,        File.join(ROOT, 'faye', 'error')
  autoload :Transport,    File.join(ROOT, 'faye', 'transport', 'transport')

  autoload :RackAdapter,  File.join(ROOT, 'faye', 'adapters', 'rack_adapter')
  autoload :StaticServer, File.join(ROOT, 'faye', 'adapters', 'static_server')

  BAYEUX_VERSION   = '1.0'
  JSONP_CALLBACK   = 'jsonpcallback'
  CONNECTION_TYPES = %w[long-polling cross-origin-long-polling callback-polling websocket eventsource in-process]

  MANDATORY_CONNECTION_TYPES = %w[long-polling callback-polling in-process]

  class << self
    attr_accessor :logger
  end

  def self.ensure_reactor_running!
    Engine.ensure_reactor_running!
  end

  def self.random(*args)
    Engine.random(*args)
  end

  def self.client_id_from_messages(messages)
    first = [messages].flatten.find { |m| m['channel'] == '/meta/connect' }
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
