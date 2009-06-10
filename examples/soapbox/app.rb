require 'rubygems'
require 'sinatra'

get '/' do
  @server = env['faye.server']
  erb :index
end

