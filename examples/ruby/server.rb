require 'rubygems'

dir = File.dirname(__FILE__)
require File.expand_path(dir + '/../../lib/faye')
require File.expand_path(dir + '/app')

# Faye::Logging.log_level = :debug

server = Faye::RackAdapter.new(Sinatra::Application,
  :mount   => '/bayeux',
  :timeout => 25,
  :engine  => {:type => 'redis'}
)

port   = ARGV[0] || 9292
secure = ARGV[1] == 'ssl'

EM.run {
  thin = Rack::Handler.get('thin')
  thin.run(server, :Port => port) do |s|
    
    if secure
      s.ssl = true
      s.ssl_options = {
        :private_key_file => dir + '/../shared/server.key',
        :cert_chain_file  => dir + '/../shared/server.crt'
      }
    end
  end
  
  server.get_client.subscribe '/chat/*' do |message|
    puts "[#{ message['user'] }]: #{ message['message'] }"
  end

  server.bind(:subscribe) do |client_id, channel|
    puts "[  SUBSCRIBE] #{client_id} -> #{channel}"
  end

  server.bind(:unsubscribe) do |client_id, channel|
    puts "[UNSUBSCRIBE] #{client_id} -> #{channel}"
  end

  server.bind(:disconnect) do |client_id|
    puts "[ DISCONNECT] #{client_id}"
  end
}
