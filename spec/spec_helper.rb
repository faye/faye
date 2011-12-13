require 'bundler/setup'
dir = File.expand_path(File.dirname(__FILE__))
require dir + '/../lib/faye'
require dir + '/../vendor/em-rspec/lib/em-rspec'
require 'rack/test'

module EncodingHelper
  def encode(string)
    return string unless string.respond_to?(:force_encoding)
    string.force_encoding("UTF-8")
  end
end

require 'ruby/engine'

