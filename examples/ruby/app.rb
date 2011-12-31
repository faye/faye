require 'sinatra'
ROOT_DIR = File.dirname(__FILE__) + '/../shared'
set :root, ROOT_DIR
set :logging, false

get('/') {
  File.read(ROOT_DIR + '/public/index.html')
}

get('/post') {
  env['faye.client'].publish('/mentioning/*', {
    :user => 'sinatra',
    :message => params[:message]
  })
  params[:message]
}

