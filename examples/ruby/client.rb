# This script demonstrates a logger for the chat app. First, start
# the chat server in one terminal then run this in another:
# 
#   $ ruby examples/ruby/server.rb
#   $ ruby examples/ruby/client.rb
# 
# The client connects to the chat server and logs all messages
# sent by all connected users.

require 'rubygems'

dir = File.dirname(__FILE__)
require File.expand_path(dir + '/../../lib/faye')

port = ARGV[0] || 9293

EM.run {
  client = Faye::Client.new(:host => 'localhost', :port => port)
  
  client.subscribe '/chat/*' do |message|
    user = message['user']
    
    client.publish("/members/#{ user }", {
      "user"    => "ruby-tcpbot",
      "message" => "Got your message, #{ user }!"
    })
  end
}

