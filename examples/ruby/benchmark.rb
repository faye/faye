require 'rubygems'
require 'bundler/setup'
require 'faye'

port   = ARGV[0] || 9292
path   = ARGV[1] || 'bayeux'
scheme = ARGV[2] == 'tls' ? 'https' : 'http'

EM.run {
  A = Faye::Client.new("#{scheme}://localhost:#{port}/#{path}")
  B = Faye::Client.new("#{scheme}://localhost:#{port}/#{path}")

  A.connect do
    B.connect do

      time = Time.now.to_f * 1000
      MAX  = 1000

      stop = lambda do
        puts Time.now.to_f * 1000 - time
        EM.stop
      end

      handle = lambda do |client, channel|
        lambda do |n|
          if n == MAX
            stop.call
          else
            client.publish(channel, n + 1)
          end
        end
      end

      sub_a = A.subscribe('/chat/a', &handle.call(A, '/chat/b'))
      sub_b = B.subscribe('/chat/b', &handle.call(B, '/chat/a'))

      sub_a.callback do
        sub_b.callback do
          puts 'START'
          A.publish('/chat/b', 0)
        end
      end
    end
  end
}
