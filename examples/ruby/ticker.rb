require 'rubygems'
require 'bundler/setup'
require 'faye'

EM.run {
  endpoint = ARGV.first || 'http://localhost:9292/bayeux'
  client   = Faye::Client.new(endpoint)
  n        = 0

  EM.add_periodic_timer 1 do
    n += 1
    client.publish('/chat/tick', 'n' => n)
  end
}
