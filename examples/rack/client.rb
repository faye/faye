# This script demonstrates a logger for the chat app. First, start
# the chat server in one terminal then run this in another:
# 
#   $ rackup examples/rack/config.ru
#   $ ruby examples/rack/client.rb
# 
# The client connects to the chat server and logs all messages
# sent by all connected users.

dir = File.dirname(__FILE__)
require dir + '/../../lib/faye'

EM.run do
  client = Faye::Client.new('http://localhost:9292/comet')
  client.connect do
    client.subscribe '/from/*' do |message|
      puts "[#{ message['user'] }]: #{ message['message'] }"
    end
  end
end

