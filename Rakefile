# -*- ruby -*-

require 'rubygems'
require 'hoe'
require './lib/faye.rb'

Hoe.spec('faye') do
  self.developer('James Coglan', 'jcoglan@googlemail.com')
  self.description = 'Simple pub/sub messaging for the web'
  self.extra_deps = [
    ['eventmachine', '>= 0.12'],
    ['em-http-request', '>= 0.2'],
    ['rack', '>= 1.0'],
    ['thin', '>= 1.2'],
    ['json', '>= 1.0']
  ]
end

# vim: syntax=Ruby

task :handshake, :port, :n, :c do |t, args|
  require 'cgi'
  require 'json'
  
  message = {:channel => '/meta/handshake',
             :version => '1.0',
             :supportedConnectionTypes => ['long-polling']}
  
  message = CGI.escape(JSON.dump message)
  url = "http://127.0.0.1:#{args[:port]}/bayeux?jsonp=callback&message=#{message}"
  puts "Request URL:\n#{url}\n\n"
  
  system "ab -n #{args[:n]} -c #{args[:c]} '#{url}'"
end
