require 'rubygems'
require 'json'

class Faye
  VERSION = '0.1.0'
  
  ROOT = File.dirname(__FILE__)
  CLIENT_SCRIPT = File.join(ROOT, 'faye-min.js')
  
  def self.client_script
    @client_script ||= File.read(CLIENT_SCRIPT)
  end
end

