require "spec_helper"

describe "server extensions" do
  let(:engine) do
    engine = double "engine"
    engine.stub(:interval).and_return(0)
    engine.stub(:timeout).and_return(60)
    engine
  end

  let(:server)  { Faye::Server.new }
  let(:message) { {"channel" => "/foo", "data" => "hello"} }

  before do
    Faye::Engine.stub(:get).and_return engine
  end

  describe "with an incoming extension installed" do
    before do
      extension = Class.new do
        def incoming(message, callback)
          message["ext"] = {"auth" => "password"}
          callback.call(message)
        end
      end
      server.add_extension(extension.new)
    end

    it "passes incoming messages through the extension" do
      engine.should_receive(:publish).with({"channel" => "/foo", "data" => "hello", "ext" => {"auth" => "password"}})
      server.process(message, false) {}
    end

    it "does not pass outgoing messages through the extension" do
      server.stub(:handshake).and_yield(message)
      engine.stub(:publish)
      response = nil
      server.process({"channel" => "/meta/handshake"}, false) { |r| response = r }
      response.should == [{"channel" => "/foo", "data" => "hello"}]
    end
  end

  describe "with an outgoing extension installed" do
    before do
      extension = Class.new do
        def outgoing(message, callback)
          message["ext"] = {"auth" => "password"}
          callback.call(message)
        end
      end
      server.add_extension(extension.new)
    end

    it "does not pass incoming messages through the extension" do
      engine.should_receive(:publish).with({"channel" => "/foo", "data" => "hello"})
      server.process(message, false) {}
    end

    it "passes outgoing messages through the extension" do
      server.stub(:handshake).and_yield(message)
      engine.stub(:publish)
      response = nil
      server.process({"channel" => "/meta/handshake"}, false) { |r| response = r }
      response.should == [{"channel" => "/foo", "data" => "hello", "ext" => {"auth" => "password"}}]
    end
  end
end
