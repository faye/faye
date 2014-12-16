require 'sinatra'
require 'faye'
require 'permessage_deflate'

ROOT_DIR = File.expand_path('../..', __FILE__)
set :root, ROOT_DIR
set :logging, false

get '/' do
  File.read(ROOT_DIR + '/public/index.html')
end

get '/post' do
  env['faye.client'].publish('/mentioning/*', {
    :user => 'sinatra',
    :message => params[:message]
  })
  params[:message]
end

App = Faye::RackAdapter.new(Sinatra::Application,
  :mount   => '/bayeux',
  :timeout => 25
)

App.add_websocket_extension(PermessageDeflate)

def App.log(message)
end

App.on(:subscribe) do |client_id, channel|
  puts "[  SUBSCRIBE] #{client_id} -> #{channel}"
end

App.on(:unsubscribe) do |client_id, channel|
  puts "[UNSUBSCRIBE] #{client_id} -> #{channel}"
end

App.on(:disconnect) do |client_id|
  puts "[ DISCONNECT] #{client_id}"
end
