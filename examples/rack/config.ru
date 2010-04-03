dir = File.dirname(__FILE__)

require dir + '/../../lib/faye'
require dir + '/app'

use Faye::RackAdapter, :mount => '/cometd', :timeout => 5
run Sinatra::Application

