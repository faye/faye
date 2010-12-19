require 'rspec/mocks'

module RSpec
  class Mocks::MessageExpectation
    def and_yield(value)
      @return_block = lambda { |*args| args.last.call(value) }
    end
  end
  
  class Core::ExampleGroup
    def should_yield(expected)
      lambda { |value| value.should == expected }
    end
  end
end

root = File.expand_path(File.dirname(__FILE__) + '/..')
require root + '/lib/faye'
Faye.ensure_reactor_running!

