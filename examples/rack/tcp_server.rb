require 'rubygems'

dir = File.dirname(__FILE__)
require File.expand_path(dir + '/../../lib/faye')

server = Faye::TcpAdapter.new(:engine => {:type => 'redis'})
server.listen(3000)
