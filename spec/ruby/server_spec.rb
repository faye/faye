require "spec_helper"

describe Faye::Server do
  let(:engine) { double "engine" }
  let(:server) { Faye::Server.new }

  before do
    Faye::Engine.stub(:get).and_return engine
  end

  describe :process do
    let(:handshake)   {{"channel" => "/meta/handshake",   "data" => "handshake"  }}
    let(:connect)     {{"channel" => "/meta/connect",     "data" => "connect"    }}
    let(:disconnect)  {{"channel" => "/meta/disconnect",  "data" => "disconnect" }}
    let(:subscribe)   {{"channel" => "/meta/subscribe",   "data" => "subscribe"  }}
    let(:unsubscribe) {{"channel" => "/meta/unsubscribe", "data" => "unsubscribe"}}
    let(:publish)     {{"channel" => "/some/channel",     "data" => "publish"    }}

    before do
      engine.stub(:interval).and_return(0)
      engine.stub(:timeout).and_return(60)
    end

    it "returns an empty response for no messages" do
      response = nil
      server.process([], false) { |r| response = r }
      response.should == []
    end

    it "ignores invalid messages" do
      response = nil
      server.process([{}, {"channel" => "invalid"}], false) { |r| response = r }
      response.should == [
        { "successful"  => false,
          "error"       => "405::Invalid channel"
        },
        { "channel"     => "invalid",
          "successful"  => false,
          "error"       => "405:invalid:Invalid channel"
        }
      ]
    end

    it "rejects unknown meta channels" do
      response = nil
      server.process([{"channel" => "/meta/p"}], false) { |r| response = r }
      response.should == [
        { "channel"     => "/meta/p",
          "successful"  => false,
          "error"       => "403:/meta/p:Forbidden channel"
        }
      ]
    end

    it "routes single messages to appropriate handlers" do
      server.should_receive(:handshake).with(handshake, false)
      server.process(handshake, false) {}
    end

    it "routes a list of messages to appropriate handlers" do
      server.should_receive(:handshake).with(handshake, false)
      server.should_receive(:connect).with(connect, false)
      server.should_receive(:disconnect).with(disconnect, false)
      server.should_receive(:subscribe).with(subscribe, false)
      server.should_receive(:unsubscribe).with(unsubscribe, false)

      engine.should_not_receive(:publish).with(handshake)
      engine.should_not_receive(:publish).with(connect)
      engine.should_not_receive(:publish).with(disconnect)
      engine.should_not_receive(:publish).with(subscribe)
      engine.should_not_receive(:publish).with(unsubscribe)
      engine.should_receive(:publish).with(publish)

      server.process([handshake, connect, disconnect, subscribe, unsubscribe, publish], false)
    end

    describe "handshaking" do
      before do
        response = {"channel" => "/meta/handshake", "successful" => true}
        server.should_receive(:handshake).with(handshake, false).and_yield(response)
      end

      it "returns the handshake response with advice" do
        server.process(handshake, false) do |response|
          response.should == [
            { "channel" => "/meta/handshake",
              "successful" => true,
              "advice" => {"reconnect" => "retry", "interval" => 0, "timeout" => 60000}
            }
          ]
        end
      end
    end

    describe "connecting for messages" do
      let(:messages) { [{"channel" => "/a"}, {"channel" => "/b"}] }

      before do
        server.should_receive(:connect).with(connect, false).and_yield(messages)
      end

      it "returns the new messages" do
        server.process(connect, false) { |r| r.should == messages }
      end
    end
  end
end
