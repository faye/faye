require 'bundler/setup'
dir = File.expand_path(File.dirname(__FILE__))
require dir + '/../lib/faye'
require dir + '/../vendor/em-rspec/lib/em-rspec'
require 'rack/test'
  