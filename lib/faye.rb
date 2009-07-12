require 'forwardable'
require 'observer'
require 'set'
require 'rubygems'
require 'eventmachine'
require 'rack'

module Faye
  VERSION = '0.2.0'
  
  ROOT = File.expand_path(File.dirname(__FILE__))
  CLIENT_SCRIPT = File.join(ROOT, 'faye-min.js')
  
  BAYEUX_VERSION   = '1.0'
  ID_LENGTH        = 128
  JSONP_CALLBACK   = 'jsonpcallback'
  CONNECTION_TYPES = %w[long-polling callback-polling]
  
  DAEMON_HOST = '0.0.0.0'
  DAEMON_PORT = 8118
  
  %w[grammar server channel connection error].each do |lib|
    require File.join(ROOT, 'faye', lib)
  end
  
  autoload :RackAdapter, File.join(ROOT, 'faye', 'rack_adapter')
  autoload :Proxy,       File.join(ROOT, 'faye', 'proxy')
  
  def self.rack_handler
    %w[thin mongrel webrick].each do |httpd|
      begin
        return Rack::Handler.get(httpd)
      rescue LoadError, NameError
      end
    end
  end
  
  def self.random(bitlength = ID_LENGTH)
    field  = 2 ** bitlength
    strlen = bitlength / 4
    ("%0#{strlen}s" % rand(field).to_s(16)).gsub(' ', '0')
  end
end

