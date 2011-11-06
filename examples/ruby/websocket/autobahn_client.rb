require 'rubygems'
require File.expand_path('../../../../lib/faye', __FILE__)
require 'cgi'

EM.run {
  host   = 'ws://localhost:9001'
  agent  = "Faye (Ruby #{RUBY_VERSION})"
  cases  = 0
  skip   = [247,248,249]
  
  socket = Faye::WebSocket::Client.new("#{host}/getCaseCount")
  
  socket.onmessage = lambda do |event|
    puts "Total cases to run: #{event.data}"
    cases = event.data.to_i
  end
  
  socket.onclose = lambda do |event|
    run_case = lambda do |n|
      if n > cases
        socket = Faye::WebSocket::Client.new("#{host}/updateReports?agent=%22#{CGI.escape agent}%22")
        socket.onclose = lambda { |e| EM.stop }
        
      elsif skip.include?(n)
        EM.next_tick { run_case.call(n+1) }
        
      else
        puts "Running test case ##{n} ..."
        socket = Faye::WebSocket::Client.new("#{host}/runCase?case=#{n}&agent=%22#{CGI.escape agent}%22")
        
        socket.onmessage = lambda do |event|
          socket.send(event.data)
        end
        
        socket.onclose = lambda do |event|
          run_case.call(n + 1)
        end
      end
    end
    
    run_case.call(1)
  end
}

