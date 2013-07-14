require "spec_helper"

describe "server connect" do
  let(:engine) { double "engine" }
  let(:server) { Faye::Server.new }

  before do
    Faye::Engine.stub(:get).and_return engine
  end

  describe :connect do
    let(:client_id) { "fakeclientid" }
    let(:message) {{"channel" => "/meta/connect",
                    "clientId" => "fakeclientid",
                    "connectionType" => "long-polling"
                  }}

    describe "with valid paramters" do
      before do
        message["advice"] = {"timeout" => 60}
        engine.should_receive(:client_exists).with(client_id).and_yield true
      end

      it "connects to the engine to wait for new messages" do
        engine.should_receive(:connect).with(client_id, {"timeout" => 60})
        server.connect(message) {}
      end

      it "returns a successful response and any queued messages" do
        engine.stub(:connect).and_yield([{"channel" => "/x", "data" => "hello"}])
        server.connect(message) do |response|
          response.should == [
            { "channel"    => "/meta/connect",
              "successful" => true,
              "clientId"   => client_id
            }, {
              "channel" => "/x",
              "data"    => "hello"
            }
          ]
        end
      end

      describe "with a message id" do
        before { message["id"] = "foo" }

        it "returns the same id" do
          engine.stub(:connect)
          server.connect(message) do |response|
            response.should == {
              "channel"    => "/meta/connect",
              "successful" => true,
              "clientId"   => client_id,
              "id"         => "foo"
            }
          end
        end
      end
    end

    describe "with an unknown client" do
      before do
        engine.should_receive(:client_exists).with(client_id).and_yield false
      end

      it "does not connect to the engine" do
        engine.should_not_receive(:connect)
        server.connect(message) {}
      end

      it "returns an unsuccessful response" do
        server.connect(message) do |response|
          response.should == {
            "channel"    => "/meta/connect",
            "successful" => false,
            "error"      => "401:fakeclientid:Unknown client"
          }
        end
      end
    end

    describe "missing clientId" do
      before do
        message.delete("clientId")
        engine.should_receive(:client_exists).with(nil).and_yield false
      end

      it "does not connect to the engine" do
        engine.should_not_receive(:connect)
        server.connect(message) {}
      end

      it "returns an unsuccessful response" do
        server.connect(message) do |response|
          response.should == {
            "channel"    => "/meta/connect",
            "successful" => false,
            "error"      => "402:clientId:Missing required parameter"
          }
        end
      end
    end

    describe "missing connectionType" do
      before do
        message.delete("connectionType")
        engine.should_receive(:client_exists).with(client_id).and_yield true
      end

      it "does not connect to the engine" do
        engine.should_not_receive(:connect)
        server.connect(message) {}
      end

      it "returns an unsuccessful response" do
        server.connect(message) do |response|
          response.should == {
            "channel"    => "/meta/connect",
            "successful" => false,
            "error"      => "402:connectionType:Missing required parameter"
          }
        end
      end
    end

    describe "with an unknown connectionType" do
      before do
        message["connectionType"] = "flash"
        engine.should_receive(:client_exists).with(client_id).and_yield true
      end

      it "does not connect to the engine" do
        engine.should_not_receive(:connect)
        server.connect(message) {}
      end

      it "returns an unsuccessful response" do
        server.connect(message) do |response|
          response.should == {
            "channel"    => "/meta/connect",
            "successful" => false,
            "error"      => "301:flash:Connection types not supported"
          }
        end
      end
    end

    describe "with an error" do
      before do
        message["error"] = "invalid"
        engine.should_receive(:client_exists).with(client_id).and_yield true
      end

      it "does not connect to the engine" do
        engine.should_not_receive(:connect)
        server.connect(message) {}
      end

      it "returns an unsuccessful response" do
        server.connect(message) do |response|
          response.should == {
            "channel"    => "/meta/connect",
            "successful" => false,
            "error"      => "invalid"
          }
        end
      end
    end
  end
end
