require "spec_helper"

describe "server disconnect" do
  let(:engine) { double "engine" }
  let(:server) { Faye::Server.new }

  before do
    Faye::Engine.stub(:get).and_return engine
  end

  describe :disconnect do
    let(:client_id) { "fakeclientid" }
    let(:message) {{"channel" => "/meta/disconnect",
                    "clientId" => "fakeclientid"
                  }}

    describe "with valid parameters" do
      before do
        engine.should_receive(:client_exists).with(client_id).and_yield true
      end

      it "destroys the client" do
        engine.should_receive(:destroy_client).with(client_id)
        server.disconnect(message) {}
      end

      it "returns a successful response" do
        engine.stub(:destroy_client)
        server.disconnect(message) do |response|
          response.should == {
            "channel"    => "/meta/disconnect",
            "successful" => true,
            "clientId"   => client_id
          }
        end
      end

      describe "with a message id" do
        before { message["id"] = "foo" }

        it "returns the same id" do
          engine.stub(:destroy_client)
          server.disconnect(message) do |response|
            response.should == {
              "channel"    => "/meta/disconnect",
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

      it "does not destroy the client" do
        engine.should_not_receive(:destroy_client)
        server.disconnect(message) {}
      end

      it "returns an unsuccessful response" do
        server.disconnect(message) do |response|
          response.should == {
            "channel"    => "/meta/disconnect",
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

      it "does not destroy the client" do
        engine.should_not_receive(:destroy_client)
        server.disconnect(message) {}
      end

      it "returns an unsuccessful response" do
        server.disconnect(message) do |response|
          response.should == {
            "channel"    => "/meta/disconnect",
            "successful" => false,
            "error"      => "402:clientId:Missing required parameter"
          }
        end
      end
    end

    describe "with an error" do
      before do
        message["error"] = "invalid"
        engine.should_receive(:client_exists).with(client_id).and_yield true
      end

      it "does not destroy the client" do
        engine.should_not_receive(:destroy_client)
        server.disconnect(message) {}
      end

      it "returns an unsuccessful response" do
        server.disconnect(message) do |response|
          response.should == {
            "channel"    => "/meta/disconnect",
            "successful" => false,
            "error"      => "invalid"
          }
        end
      end
    end
  end
end
