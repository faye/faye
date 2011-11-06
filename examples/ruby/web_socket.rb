require 'rubygems'
require File.expand_path('../../../lib/faye', __FILE__)

port = ARGV[0] || 7000

EM.run {
  socket = Faye::WebSocket::Client.new("socket://localhost:#{port}/")
  
  socket.onopen = lambda do |event|
    p [:open]
    socket.send JSON.dump('channel' => '/meta/handshake')
  end
  
  socket.onmessage = lambda do |event|
    p [:message, event.data]
    socket.close 1002, 'Going away'
  end
  
  socket.onclose = lambda do |event|
    p [:close, event.code, event.reason]
    EM.stop
  end
}
