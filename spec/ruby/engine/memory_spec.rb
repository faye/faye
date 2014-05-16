require "spec_helper"

describe Faye::Engine::Memory do
  let(:engine_opts)  { {:type => Faye::Engine::Memory} }
  it_should_behave_like "faye engine"
end
