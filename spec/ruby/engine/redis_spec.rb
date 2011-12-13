require "spec_helper"

describe Faye::Engine::Redis do
  let(:engine_opts)  { {:type => Faye::Engine::Redis, :password => "foobared", :namespace => Time.now.to_i.to_s} }
  
  after do
    engine.disconnect
    redis = EM::Hiredis::Client.connect('localhost', 6379)
    redis.auth(engine_opts[:password])
    redis.flushall
  end
  
  it_should_behave_like "faye engine"
  it_should_behave_like "distributed engine"
  
  describe "using a Unix socket" do
    before { engine_opts[:socket] = "/tmp/redis.sock" }
    it_should_behave_like "faye engine"
  end
end

