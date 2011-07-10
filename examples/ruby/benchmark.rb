require 'rubygems'

dir = File.dirname(__FILE__)
require File.expand_path(dir + '/../../lib/faye')

ports = ARGV.map { |s| s.to_i }
http  = "http://localhost:#{ports[0]}/bayeux"
tcp   = {:port => ports[-1] + 1}

client_a = Faye::Client.new(tcp)
client_b = Faye::Client.new(tcp)

EM.run {
  max = 1000
  start_time = Time.now
  
  handle = lambda do |client, message, socket|
    count = message['count']
    if count == max
      puts Time.now - start_time
      EM.stop
    else
      client.publish socket, 'count' => count + 1
    end
  end
  
  sub_a = client_a.subscribe '/socket/a' do |message|
    handle.call(client_a, message, '/socket/b')
  end
  
  sub_b = client_b.subscribe '/socket/b' do |message|
    handle.call(client_b, message, '/socket/a')
  end
  
  sub_a.callback do
    sub_b.callback do
      p :starting
      client_a.publish '/socket/b', 'count' => 0
    end
  end
}

