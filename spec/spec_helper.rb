require 'bundler/setup'
dir = File.expand_path(File.dirname(__FILE__))
require dir + '/../lib/faye'
require dir + '/../vendor/em-rspec/lib/em-rspec'
require 'rack/test'

module EncodingHelper
  def encode(message)
    message.respond_to?(:force_encoding) ?
        message.force_encoding("UTF-8") :
        message
  end
  
  def bytes(string)
    count = string.respond_to?(:bytes) ? string.bytes.count : string.size
    (0...count).map do |i|
      string.respond_to?(:getbyte) ? string.getbyte(i) : string[i]
    end
  end
  
  def parse(bytes)
    @parser.parse(bytes.map { |b| b.chr } * '')
  end
end

require "ruby/engine"

