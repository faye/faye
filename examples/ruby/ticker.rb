require 'rubygems'
require 'bundler/setup'
require 'faye'

EM.run {
  client = Faye::Client.new('http://localhost:9292/bayeux')
  n      = 0

  EM.add_periodic_timer 1 do
    n += 1
    client.publish('/tick', 'n' => n)
  end
}
