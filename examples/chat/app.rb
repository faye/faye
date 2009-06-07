require 'rubygems'
require 'sinatra'

ROOT = File.dirname(__FILE__)
require File.join(ROOT, '..', '..', 'lib', 'faye')

SERVER = Faye::Server.new

get '/' do
  File.read(File.join(ROOT, 'public', 'index.html'))
end

get '/faye.js' do
  File.read(Faye::CLIENT_SCRIPT)
end

post '/comet-channel' do
  while params[:message] == 'hang'
    puts 'Sleeping POST request'
    sleep(2.0)
  end
  SERVER.process(params[:message])
end

get '/comet-channel' do
  while params[:message] == 'hang'
    puts 'Sleeping GET request'
    sleep(2.0)
  end
  SERVER.process(params[:message], :jsonp => params[:callback])
end

get '/user/:id' do
  JSON.unparse :success => true, :user => params[:id]
end

post '/user/:id' do
  JSON.unparse :success => false, :user => params[:id]
end

