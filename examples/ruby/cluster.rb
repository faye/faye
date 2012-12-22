require 'rubygems'
require File.expand_path('../../../lib/faye', __FILE__)

# Faye::Logging.log_level = :debug

servers = {
  :ruby   => {:ports => [7070, 9090], :path => 'bayeux'},
  :node   => {:ports => [8000, 8000], :path => 'bayeux'},
  :cometd => {:ports => [8080, 8080], :path => 'cometd'}
}

EM.run {
  server   = servers[:ruby]
  client_a = Faye::Client.new("http://localhost:#{server[:ports][0]}/#{server[:path]}")
  client_b = Faye::Client.new("http://localhost:#{server[:ports][1]}/#{server[:path]}")

  time = nil

  sub = client_a.subscribe '/chat/foo' do |message|
    puts Time.now.to_f * 1000 - time
    puts message['text']
    EM.stop
  end

  sub.callback do
    client_b.connect do
      time = Time.now.to_f * 1000
      client_b.publish '/chat/foo', 'text' => 'Hello, cluster!'
    end
  end
}
