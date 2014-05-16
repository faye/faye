# Load and configure Capybara

require 'capybara/dsl'
require 'terminus'
Capybara.current_driver = :terminus
Capybara.app_host = 'http://localhost:9292'
extend Capybara::DSL

# Acquire some browsers and log into each with a username

NAMES = %w[alice bob carol dan erica frank gemma harold ingrid james]
BROWSERS = {}
Terminus.ensure_browsers 5

Terminus.browsers.each_with_index do |browser, i|
  name = NAMES[i]
  puts "#{name} is using #{browser}"
  BROWSERS[name] = browser
  Terminus.browser = browser
  visit '/'
  fill_in 'username', :with => name
  click_button 'Go'
end

# Send a message from each browser to every other browser, and check that it
# arrived. If it doesn't arrive, send all the browsers back to the dock and
# raise an exception

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

# Re-dock all the browsers when we're finished

Terminus.return_to_dock
