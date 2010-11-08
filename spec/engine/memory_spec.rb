require 'spec_helper'

describe Faye::Engine::Memory do
  let(:engine) { Faye::Engine::Memory.new(options) }
  it_should_behave_like "faye engine"
end

