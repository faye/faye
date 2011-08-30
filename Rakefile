require 'rubygems'
require './lib/faye'

task :example, :port, :ssl do |t, args|
  exec "ruby examples/ruby/server.rb #{args[:port]} #{args[:ssl] && 'ssl'}"
end

task :handshake, :port, :n, :c do |t, args|
  require 'cgi'
  require 'json'
  
  message = {:channel => '/meta/handshake',
             :version => '1.0',
             :supportedConnectionTypes => ['long-polling']}
  
  message = CGI.escape(JSON.dump message)
  url = "http://127.0.0.1:#{args[:port]}/bayeux?jsonp=callback&message=#{message}"
  puts "Request URL:\n#{url}\n\n"
  
  exec "ab -n #{args[:n]} -c #{args[:c]} '#{url}'"
end
