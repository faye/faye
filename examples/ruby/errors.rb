# This script demonstrates error handling

require 'rubygems'
require File.expand_path('../../../lib/faye', __FILE__)

port = ARGV[0] || 9292
path = ARGV[1] || 'bayeux'

EM.run {
  client = Faye::Client.new("http://localhost:#{port}/#{path}")

  subscription = client.subscribe '/chat/*' do |message|
    user = message['user']

    publication = client.publish("/members/#{ user }", {
      "user"    => "ruby-logger",
      "message" => "Got your message, #{ user }!"
    })
    publication.callback do
      puts "publish succeeded"
    end
    publication.errback do |error|
      puts "publish failed: #{error.inspect}"
    end
  end
  
  subscription.callback do
    puts "subscribe succeeded"
  end
  
  subscription.errback do |error|
    puts "subscribe failed: #{error.inspect}"
  end
}

