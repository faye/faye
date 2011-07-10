require 'rubygems'

dir = File.dirname(__FILE__)
require File.expand_path(dir + '/../../lib/faye')
require File.expand_path(dir + '/redis_pub_sub')

ports = ARGV.map { |s| s.to_i }
http  = "http://localhost:#{ports[0]}/bayeux"
tcp   = {:port => ports[-1] + 1}
redis = {:type => 'redis'}

client_a = Faye::Client.new(redis)
client_b = Faye::Client.new(redis)

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
  
  EM.add_timer 1 do
    p :starting
    client_a.publish '/socket/b', 'count' => 0
  end
}

