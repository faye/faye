require 'rubygems'
require 'em-hiredis'

EM.run {
  redis = EM::Hiredis::Client.connect
  redis.flushall { EM.stop }
}
