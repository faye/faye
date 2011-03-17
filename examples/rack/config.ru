dir = ::File.dirname(__FILE__)

require File.expand_path(dir + '/../../lib/faye')
require File.expand_path(dir + '/app')

use Faye::RackAdapter, :engine => :redis,
                       :mount => '/bayeux',
                       :timeout => 20

run Sinatra::Application

