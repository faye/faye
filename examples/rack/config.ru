dir = ::File.dirname(__FILE__)

require dir + '/../../lib/faye'
require dir + '/app'

use Faye::RackAdapter, :mount => '/bayeux', :timeout => 20
run Sinatra::Application

