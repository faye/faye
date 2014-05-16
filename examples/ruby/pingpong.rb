require 'rubygems'
require 'bundler/setup'
require 'faye'

EM.run {
  ENDPOINT = 'http://localhost:9292/bayeux'
  puts 'Connecting to ' + ENDPOINT

  ping = Faye::Client.new(ENDPOINT)
  ping.subscribe('/ping') do
    puts 'PING'
    EM.add_timer(1) { ping.publish('/pong', {}) }
  end

  pong = Faye::Client.new(ENDPOINT)
  pong.subscribe('/pong') do
    puts 'PONG'
    EM.add_timer(1) { ping.publish('/ping', {}) }
  end

  EM.add_timer(0.5) { ping.publish('/pong', {}) }
}
