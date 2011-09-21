require 'rubygems'

dir = File.dirname(__FILE__)
require File.expand_path(dir + '/../../lib/faye')

EM.run {
  ws = Faye::WebSocket::Client.new('ws://localhost:8000/bayeux')
  
  ws.onopen = lambda do |event|
    puts "OPEN"
    ws.send JSON.dump('channel' => '/meta/handshake')
  end
  ws.onmessage = lambda do |message|
    puts message.data
  end
}
