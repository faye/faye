require 'sinatra'
require 'faye'

ROOT_DIR = File.expand_path('../../shared', __FILE__)
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

class Ext
  def incoming(m, e, c)
    p e
    c[m]
  end
end

App.add_extension(Ext.new)

def App.log(message)
end

App.bind(:subscribe) do |client_id, channel|
  puts "[  SUBSCRIBE] #{client_id} -> #{channel}"
end

App.bind(:unsubscribe) do |client_id, channel|
  puts "[UNSUBSCRIBE] #{client_id} -> #{channel}"
end

App.bind(:disconnect) do |client_id|
  puts "[ DISCONNECT] #{client_id}"
end

