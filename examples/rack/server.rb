require 'rubygems'

dir = File.dirname(__FILE__)
require File.expand_path(dir + '/../../lib/faye')
require File.expand_path(dir + '/app')

server = Faye::RackAdapter.new(Sinatra::Application,
  :mount   => '/bayeux',
  :timeout => 25,
  :engine  => {:type => 'redis'}
)

port = ARGV[0] || 9292

EM.run {
  thin = Rack::Handler.get('thin')
  thin.run(server, :Port => port)
  
  server.get_client.subscribe '/chat/*' do |message|
    puts "[#{ message['user'] }]: #{ message['message'] }"
  end
}
