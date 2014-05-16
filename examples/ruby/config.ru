# Run using your favourite async server:
#
#     thin start -R examples/ruby/config.ru -p 9292
#     rainbows -c examples/ruby/rainbows.conf -E production examples/ruby/config.ru -p 9292
#
# If you run using one of these commands, the webserver is loaded before this
# file, so Faye::WebSocket can figure out which adapter to load. If instead you
# run using `rackup`, you need the `load_adapter` line below.
#
#     rackup -E production -s thin examples/ruby/config.ru -p 9292

require 'rubygems'
require 'bundler/setup'
require File.expand_path('../app', __FILE__)
Faye::WebSocket.load_adapter('thin')

run App
