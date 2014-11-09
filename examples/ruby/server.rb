require 'rubygems'
require 'bundler/setup'

port   = ARGV[0] || 9292
secure = ARGV[1] == 'tls'
engine = ARGV[2] || 'thin'
shared = File.expand_path('../..', __FILE__)

require File.expand_path('../app', __FILE__)
Faye::WebSocket.load_adapter(engine)

case engine

when 'goliath'
  class FayeServer < Goliath::API
    def response(env)
      App.call(env)
    end
  end

when 'puma'
  events = Puma::Events.new($stdout, $stderr)
  binder = Puma::Binder.new(events)
  binder.parse(["tcp://0.0.0.0:#{port}"], App)
  server = Puma::Server.new(App, events)
  server.binder = binder
  server.run.join

when 'rainbows'
  rackup = Unicorn::Configurator::RACKUP
  rackup[:port] = port
  rackup[:set_listener] = true
  options = rackup[:options]
  options[:config_file] = File.expand_path('../rainbows.conf', __FILE__)
  Rainbows::HttpServer.new(App, options).start.join

when 'thin'
  EM.run {
    thin = Rack::Handler.get('thin')
    thin.run(App, :Port => port) do |server|
      if secure
        server.ssl_options = {
          :private_key_file => shared + '/server.key',
          :cert_chain_file  => shared + '/server.crt'
        }
        server.ssl = true
      end
    end
  }
end
