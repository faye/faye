# This script demonstrates a logger for the chat app. First, start
# the chat server in one terminal then run this in another:
# 
#   $ rackup examples/ruby/config.ru -s thin -E production
#   $ ruby examples/ruby/client.rb
# 
# The client connects to the chat server and logs all messages
# sent by all connected users.

require 'rubygems'

dir = File.dirname(__FILE__)
require File.expand_path(dir + '/../../lib/faye')

port = ARGV[0] || 9292
path = ARGV[1] || 'bayeux'

EM.run do
  client = Faye::Client.new("http://localhost:#{port}/#{path}")
  
  client.subscribe '/chat/*' do |message|
    user = message['user']
    puts "[#{ user }]: #{ message['message'] }"
    client.publish("/members/#{ user }", {
      "user"    => "ruby-logger",
      "message" => "Got your message, #{ user }!"
    })
  end
end

