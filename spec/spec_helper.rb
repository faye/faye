require 'rubygems'
require 'bundler/setup'
require 'rack/proxy'
require 'rack/test'
require 'rspec/em'

require 'puma'
require 'puma/binder'
require 'puma/events'

require File.expand_path('../../lib/faye', __FILE__)

require 'ruby/encoding_helper'
require 'ruby/server_proxy'
require 'ruby/engine_examples'

class EnvelopeMatcher
  def initialize(message)
    @message = message
  end

  def ==(other)
    Faye::Envelope === other and @message == other.message
  end
end

