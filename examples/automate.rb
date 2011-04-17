dir = ::File.dirname(__FILE__)
$LOAD_PATH.unshift(dir + '/../lib')

require File.expand_path(dir + '/../vendor/terminus/lib/terminus')

require File.expand_path(dir + '/rack/app')
application = Rack::Builder.new {
  use Faye::RackAdapter, :mount => '/bayeux', :timeout => 20
  run Sinatra::Application
}

require 'capybara/dsl'
Capybara.current_driver = :terminus
Capybara.app = application.to_app
extend Capybara

NAMES = %w[alice bob carol dan erica frank gemma harold ingrid james]
BROWSERS = {}

Terminus.ensure_browsers 10

Terminus.browsers.each_with_index do |browser, i|
  name = NAMES[i]
  puts "#{name} is using #{browser}"
  BROWSERS[name] = browser
  Terminus.browser = browser
  visit '/'
  fill_in 'username', :with => NAMES[i]
  click_button 'Go'
end

BROWSERS.each do |name, sender|
  BROWSERS.each do |at, target|
    next if at == name
    
    Terminus.browser = sender
    fill_in 'message', :with => "@#{at} Hello, world!"
    click_button 'Send'
    
    Terminus.browser = target
    unless page.has_content?("#{name}: @#{at} Hello, world!")
      Terminus.return_to_dock
      raise "Message did not make it from #{sender} to #{target}"
    end
  end
end

Terminus.return_to_dock
