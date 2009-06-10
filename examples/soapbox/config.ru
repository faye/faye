dir = File.dirname(__FILE__)

require dir + '/../../lib/faye'
require dir + '/app'

use Faye::App, :mount => '/comet'
run Sinatra::Application

