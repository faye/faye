require 'rubygems'
require 'json'

module Faye
  VERSION = '0.1.0'
  
  ROOT = File.expand_path(File.dirname(__FILE__))
  CLIENT_SCRIPT = File.join(ROOT, 'faye-min.js')
  
  ID_LENGTH        = 128
  JSONP_CALLBACK   = 'jsonpcallback'
  CONNECTION_TYPES = %w[long-polling callback-polling]
  
  %w[grammar server client].each do |lib|
    require File.join(Faye::ROOT, 'faye', lib)
  end
  
  class Channel
    HANDSHAKE   = '/meta/handshake'
    CONNECT     = '/meta/connect'
    SUBSCRIBE   = '/meta/subscribe'
    UNSUBSCRIBE = '/meta/unsubscribe'
    DISCONNECT  = '/meta/disconnect'
    ECHO        = '/service/echo'
  end
  
  def self.random(bitlength = ID_LENGTH)
    field  = 2 ** bitlength
    strlen = bitlength / 4
    ("%0#{strlen}s" % rand(field).to_s(16)).gsub(' ', '0')
  end
end

