# This script demonstrates a logger for the chat app. First, start
# the chat server in one terminal then run this in another:
# 
#   $ ruby examples/rack/server.rb
#   $ ruby examples/rack/client.rb
# 
# The client connects to the chat server and logs all messages
# sent by all connected users.

require 'rubygems'

dir = File.dirname(__FILE__)
require File.expand_path(dir + '/../../lib/faye')

port = ARGV[0] || 9292
path = ARGV[1] || 'bayeux'

EM.run {
  client = Faye::Client.new("http://localhost:#{port}/#{path}")
  
  client.subscribe '/chat/*' do |message|
    user = message['user']
    
    client.publish("/members/#{ user }", {
      "user"    => "ruby-logger",
      "message" => "Got your message, #{ user }!"
    })
  end
}

