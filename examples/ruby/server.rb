require 'rubygems'

dir = File.dirname(__FILE__)
require File.expand_path(dir + '/../../lib/faye')
require File.expand_path(dir + '/app')

http = Faye::Adapter::Http.new(Sinatra::Application,
  :mount   => '/bayeux',
  :timeout => 25,
  :engine  => {:type => 'redis'}
)

tcp = Faye::Adapter::Tcp.new(:engine => {:type => 'redis'})

port = (ARGV[0] || 9292).to_i

EM.run {
  thin = Rack::Handler.get('thin')
  thin.run(http, :Port => port)
  
  tcp.listen(port + 1)
  puts ">> TCP listening on #{port + 1}"
  
  http.get_client.subscribe '/chat/*' do |message|
    puts "[#{ message['user'] }]: #{ message['message'] }"
  end
}
