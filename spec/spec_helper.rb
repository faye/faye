require 'bundler/setup'
dir = File.expand_path(File.dirname(__FILE__))
require dir + '/../lib/faye'
require dir + '/../vendor/em-rspec/lib/em-rspec'
require 'rack/test'

Faye.logger = lambda { |*| }

require 'encoding_helper'
require 'ruby/engine_examples'

