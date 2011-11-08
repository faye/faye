require 'base64'
require 'cgi'
require 'cookiejar'
require 'digest/md5'
require 'digest/sha1'
require 'em-http'
require 'em-http/version'
require 'eventmachine'
require 'forwardable'
require 'json'
require 'rack'
require 'set'
require 'thin'
require 'time'
require 'uri'

module Faye
  VERSION = '0.6.7'
  
  ROOT = File.expand_path(File.dirname(__FILE__))
  require File.join(ROOT, 'faye', 'thin_extensions')
  
  autoload :Publisher,    File.join(ROOT, 'faye', 'mixins', 'publisher')
  autoload :Timeouts,     File.join(ROOT, 'faye', 'mixins', 'timeouts')
  autoload :Logging,      File.join(ROOT, 'faye', 'mixins', 'logging')
  
  autoload :Namespace,    File.join(ROOT, 'faye', 'util', 'namespace')
  
  autoload :Engine,       File.join(ROOT, 'faye', 'engines', 'base')
  
  autoload :Grammar,      File.join(ROOT, 'faye', 'protocol', 'grammar')
  autoload :Extensible,   File.join(ROOT, 'faye', 'protocol', 'extensible')
  autoload :Channel,      File.join(ROOT, 'faye', 'protocol', 'channel')
  autoload :Subscription, File.join(ROOT, 'faye', 'protocol', 'subscription')
  autoload :Client,       File.join(ROOT, 'faye', 'protocol', 'client')
  autoload :Server,       File.join(ROOT, 'faye', 'protocol', 'server')
  
  autoload :Transport,    File.join(ROOT, 'faye', 'transport', 'transport')
  autoload :Error,        File.join(ROOT, 'faye', 'error')
  
  autoload :RackAdapter,  File.join(ROOT, 'faye', 'adapters', 'rack_adapter')
  autoload :WebSocket,    File.join(ROOT, 'faye', 'util', 'web_socket')
  
  BAYEUX_VERSION   = '1.0'
  ID_LENGTH        = 128
  JSONP_CALLBACK   = 'jsonpcallback'
  CONNECTION_TYPES = %w[long-polling cross-origin-long-polling callback-polling websocket in-process]
  
  MANDATORY_CONNECTION_TYPES = %w[long-polling callback-polling in-process]
  
  # http://www.w3.org/International/questions/qa-forms-utf-8.en.php
  UTF8_MATCH = /^([\x00-\x7F]|[\xC2-\xDF][\x80-\xBF]|\xE0[\xA0-\xBF][\x80-\xBF]|[\xE1-\xEC\xEE\xEF][\x80-\xBF]{2}|\xED[\x80-\x9F][\x80-\xBF]|\xF0[\x90-\xBF][\x80-\xBF]{2}|[\xF1-\xF3][\x80-\xBF]{3}|\xF4[\x80-\x8F][\x80-\xBF]{2})*$/
  
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
  
  def self.copy_object(object)
    Marshal.load(Marshal.dump(object))
  end
  
  def self.encode(string, validate_encoding = false)
    if Array === string
      return nil if validate_encoding and !valid_utf8?(string)
      string = string.pack('C*')
    end
    return string unless string.respond_to?(:force_encoding)
    string.force_encoding('UTF-8')
  end
  
  def self.valid_utf8?(byte_array)
    UTF8_MATCH =~ byte_array.pack('C*') ? true : false
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

