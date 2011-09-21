require 'rubygems'

dir = File.dirname(__FILE__)
require File.expand_path(dir + '/../../lib/faye')

port = ARGV[0] || 9292
path = ARGV[1] || 'bayeux'

EM.run {
  A = Faye::Client.new("http://localhost:#{port}/#{path}")
  B = Faye::Client.new("http://localhost:#{port}/#{path}")
  
  A.connect do
    B.connect do
      
      time = Time.now.to_f * 1000
      MAX  = 1000
      
      stop = lambda do
        puts Time.now.to_f * 1000 - time
        EM.stop
      end
      
      handle = lambda do |client, channel|
        lambda do |message|
          if message['n'] == MAX
            stop.call
          else
            client.publish(channel, 'n' => message['n'] + 1)
          end
        end
      end
      
      sub_a = A.subscribe('/a', &handle.call(A, '/b'))
      sub_b = B.subscribe('/b', &handle.call(B, '/a'))
      
      sub_a.callback do
        sub_b.callback do
          puts 'START'
          A.publish('/b', 'n' => 0)
        end
      end
    end
  end
}
