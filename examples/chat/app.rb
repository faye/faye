require 'rubygems'
require 'sinatra'

ROOT = File.dirname(__FILE__)
require File.join(ROOT, '..', '..', 'lib', 'faye')

get '/' do
  File.read(File.join(ROOT, 'public', 'index.html'))
end

get '/faye.js' do
  Faye.client_script
end

get '/user/:id' do
  sleep(0.1) while params[:id] == 'hang'
  JSON.unparse :success => true, :user => params[:id]
end

post '/user/:id' do
  JSON.unparse :success => false, :user => params[:id]
end

