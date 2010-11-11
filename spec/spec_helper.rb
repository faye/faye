require 'rspec/mocks'

class RSpec::Mocks::MessageExpectation
  def and_yield(value)
    @return_block = lambda { |*args| args.last.call(value) }
  end
end

root = File.expand_path(File.dirname(__FILE__) + '/..')
require root + '/lib/faye'
Faye.ensure_reactor_running!

require 'engine_spec'

