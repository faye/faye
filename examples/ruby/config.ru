dir = ::File.dirname(__FILE__)

require File.expand_path(dir + '/../../lib/faye')
require File.expand_path(dir + '/app')

use Faye::Adapter::Http, :mount   => '/bayeux',
                         :timeout => 20,
                         :engine  => {:type => 'redis'}

run Sinatra::Application

