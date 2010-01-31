require 'sinatra'
PUBLIC_DIR = File.dirname(__FILE__) + '/../shared/public'
set :public, PUBLIC_DIR

get('/') { File.read(PUBLIC_DIR + '/index.html') }

