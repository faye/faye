require 'rubygems'
require File.expand_path('../../../lib/faye', __FILE__)
require 'rack'
require 'thin'

port = ARGV[0] || 7000

app = lambda do |env|
  if env['HTTP_UPGRADE']
    socket = Faye::WebSocket.new(env)
    socket.onmessage = lambda do |message|
      socket.send(message.data)
    end 
    [-1, {}, []]
  else
    [200, {'Content-Type' => 'text/plain'}, ['Hello']]
  end
end

EM.run {
  thin = Rack::Handler.get('thin')
  thin.run(app, :Port => port)
}
