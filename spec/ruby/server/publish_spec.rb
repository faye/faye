require "spec_helper"

describe "server publish" do
  let(:engine)  { double "engine" }
  let(:server)  { Faye::Server.new }
  let(:message) {{ "channel" => "/some/channel", "data" => "publish" }}

  before do
    Faye::Engine.stub(:get).and_return engine
  end

  describe "publishing a message" do
    it "tells the engine to publish the message" do
      engine.should_receive(:publish).with(message)
      server.process(message, false) {}
    end

    it "returns a successful response" do
      engine.stub(:publish)
      server.process(message, false) do |response|
        response.should == [
          { "channel"     => "/some/channel",
            "successful"  => true
          }
        ]
      end
    end

    describe "with an invalid channel" do
      before { message["channel"] = "channel" }

      it "does not tell the engine to publish the message" do
        engine.should_not_receive(:publish)
        server.process(message, false) {}
      end

      it "returns an unsuccessful response" do
        engine.stub(:publish)
        server.process(message, false) do |response|
          response.should == [
            { "channel"     => "channel",
              "successful"  => false,
              "error"       => "405:channel:Invalid channel"
            }
          ]
        end
      end
    end

    describe "with an error" do
      before { message["error"] = "invalid" }

      it "does not tell the engine to publish the message" do
        engine.should_not_receive(:publish)
        server.process(message, false) {}
      end

      it "returns an unsuccessful response" do
        engine.stub(:publish)
        server.process(message, false) do |response|
          response.should == [
            { "channel"     => "/some/channel",
              "successful"  => false,
              "error"       => "invalid"
            }
          ]
        end
      end
    end

    describe "to an invalid channel" do
      before { message["channel"] = "/invalid/*" }

      it "does not tell the engine to publish the message" do
        engine.should_not_receive(:publish)
        server.process(message, false) {}
      end
    end
  end
end
