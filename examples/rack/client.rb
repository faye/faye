# This script demonstrates a logger for the chat app. First, start
# the chat server in one terminal then run this in another:
# 
#   $ rackup examples/rack/config.ru -s thin -E production
#   $ ruby examples/rack/client.rb
# 
# The client connects to the chat server and logs all messages
# sent by all connected users.

dir = File.dirname(__FILE__)
require File.expand_path(dir + '/../../lib/faye')

EM.run do
  client = Faye::Client.new('http://localhost:9292/bayeux')
  
  client.subscribe '/from/*' do |message|
    user = message['user']
    puts "[#{ user }]: #{ message['message'] }"
    client.publish("/mentioning/#{ user }", {
      "user"    => "ruby-logger",
      "message" => "Got your message, #{ user }!"
    })
  end
end

