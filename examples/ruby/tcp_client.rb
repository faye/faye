require 'rubygems'

dir = File.dirname(__FILE__)
require File.expand_path(dir + '/../../lib/faye')

EM.run do
  client = Faye::Client.new(:host => 'localhost', :port => 3000)
  
  client.subscribe '/members/tcpbot' do |message|
    p message
    client.publish "/members/#{message['user']}",
                    "user"    => "tcpbot",
                    "message" => "You're a wizard, #{message['user']}!"
  end
end
