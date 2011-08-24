require 'sinatra'
PUBLIC_DIR = File.dirname(__FILE__) + '/../shared/public'
set :public, PUBLIC_DIR
set :logging, false

get('/') {
  File.read(PUBLIC_DIR + '/index.html')
}

get('/post') {
  env['faye.client'].publish('/mentioning/*', {
    :user => 'sinatra',
    :message => params[:message]
  })
  params[:message]
}

