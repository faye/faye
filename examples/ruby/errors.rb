# This script demonstrates error handling
require 'rubygems'

dir = File.dirname(__FILE__)
require File.expand_path(dir + '/../../lib/faye')

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
    publication.callback {
      puts "publish succeeded"
    }
    publication.errback { |error|
      puts "publish failed: #{error}"
    }
  end
  subscription.callback {
    puts "subscribe succeeded"
  }
  subscription.errback { |error|
    puts "subscribe failed: #{error}"
  }
}

