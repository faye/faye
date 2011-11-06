require 'forwardable'
require 'set'
require 'eventmachine'
require 'json'
require 'thin'

module Faye
  VERSION = '0.6.7'
  
  ROOT = File.expand_path(File.dirname(__FILE__))
  
  BAYEUX_VERSION   = '1.0'
  ID_LENGTH        = 128
  JSONP_CALLBACK   = 'jsonpcallback'
  CONNECTION_TYPES = %w[long-polling cross-origin-long-polling callback-polling websocket in-process]
  
  MANDATORY_CONNECTION_TYPES = %w[long-polling callback-polling in-process]
  
  # http://www.w3.org/International/questions/qa-forms-utf-8.en.php
  UTF8_MATCH = /^([\x00-\x7F]|[\xC2-\xDF][\x80-\xBF]|\xE0[\xA0-\xBF][\x80-\xBF]|[\xE1-\xEC\xEE\xEF][\x80-\xBF]{2}|\xED[\x80-\x9F][\x80-\xBF]|\xF0[\x90-\xBF][\x80-\xBF]{2}|[\xF1-\xF3][\x80-\xBF]{3}|\xF4[\x80-\x8F][\x80-\xBF]{2})*$/
  
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
      transport/web_socket
      transport/http
      error
      thin_extensions
      
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

