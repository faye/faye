require "spec_helper"

describe "server handshake" do
  let(:engine) { mock "engine" }
  let(:server) { Faye::Server.new }
  
  before do
    Faye::Engine.stub(:get).and_return engine
  end
  
  describe "with a service" do
    before do
      server.service "/service/foo" do |message, client|
        client.deliver("/foo", "hello" => "world")
      end
    end
    
    it "invokes the service when a matching message is published" do
      engine.should_receive(:deliver).with("abc123", {"channel" => "/foo", "data" => {"hello" => "world"}})
      server.process({"clientId" => "abc123", "channel" => "/service/foo", "data" => {}}, false) {}
    end
  end
  
  describe "with no matching service" do
    before do
      server.service "/service/bar" do |message, client|
        client.deliver("/foo", "hello" => "world")
      end
    end
    
    it "invokes the service when a matching message is published" do
      engine.should_not_receive(:deliver)
      server.process({"clientId" => "abc123", "channel" => "/service/foo", "data" => {}}, false) {}
    end
  end
end

