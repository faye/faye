require "spec_helper"

describe "server subscribe" do
  let(:engine) { double "engine" }
  let(:server) { Faye::Server.new }

  before do
    Faye::Engine.stub(:get).and_return engine
  end

  describe :subscribe do
    let(:client_id) { "fakeclientid" }
    let(:message) {{"channel" => "/meta/subscribe",
                    "clientId" => "fakeclientid",
                    "subscription" => "/foo"
                  }}

    describe "with valid parameters" do
      before do
        engine.should_receive(:client_exists).with(client_id).and_yield true
      end

      it "subscribes the client to the channel" do
        engine.should_receive(:subscribe).with(client_id, "/foo")
        server.subscribe(message) {}
      end

      it "returns a successful response" do
        engine.stub(:subscribe)
        server.subscribe(message) do |response|
          response.should == {
            "channel"      => "/meta/subscribe",
            "successful"   => true,
            "clientId"     => client_id,
            "subscription" => "/foo"
          }
        end
      end

      describe "with a list of subscriptions" do
        before do
          message["subscription"] = ["/foo", "/bar"]
        end

        it "creates multiple subscriptions" do
          engine.should_receive(:subscribe).with(client_id, "/foo")
          engine.should_receive(:subscribe).with(client_id, "/bar")
          server.subscribe(message) {}
        end

        it "returns a successful response" do
          engine.stub(:subscribe)
          server.subscribe(message) do |response|
            response.should == {
              "channel"      => "/meta/subscribe",
              "successful"   => true,
              "clientId"     => client_id,
              "subscription" => ["/foo", "/bar"]
            }
          end
        end
      end

      describe "with a subscription pattern" do
        before do
          message["subscription"] = "/foo/**"
        end

        it "subscribes the client to the channel pattern" do
          engine.should_receive(:subscribe).with(client_id, "/foo/**")
          server.subscribe(message) {}
        end

        it "returns a successful response" do
          engine.stub(:subscribe)
          server.subscribe(message) do |response|
            response.should == {
              "channel"      => "/meta/subscribe",
              "successful"   => true,
              "clientId"     => client_id,
              "subscription" => "/foo/**"
            }
          end
        end
      end
    end

    describe "with an unknown client" do
      before do
        engine.should_receive(:client_exists).with(client_id).and_yield false
      end

      it "does not subscribe the client to the channel" do
        engine.should_not_receive(:subscribe)
        server.subscribe(message) {}
      end

      it "returns an unsuccessful response" do
        server.subscribe(message) do |response|
          response.should == {
            "channel"      => "/meta/subscribe",
            "successful"   => false,
            "error"        => "401:fakeclientid:Unknown client",
            "clientId"     => client_id,
            "subscription" => "/foo"
          }
        end
      end
    end

    describe "missing clientId" do
      before do
        message.delete("clientId")
        engine.should_receive(:client_exists).with(nil).and_yield false
      end

      it "does not subscribe the client to the channel" do
        engine.should_not_receive(:subscribe)
        server.subscribe(message) {}
      end

      it "returns an unsuccessful response" do
        server.subscribe(message) do |response|
          response.should == {
            "channel"      => "/meta/subscribe",
            "successful"   => false,
            "error"        => "402:clientId:Missing required parameter",
            "subscription" => "/foo"
          }
        end
      end
    end

    describe "missing subscription" do
      before do
        message.delete("subscription")
        engine.should_receive(:client_exists).with(client_id).and_yield true
      end

      it "does not subscribe the client to the channel" do
        engine.should_not_receive(:subscribe)
        server.subscribe(message) {}
      end

      it "returns an unsuccessful response" do
        server.subscribe(message) do |response|
          response.should == {
            "channel"      => "/meta/subscribe",
            "successful"   => false,
            "error"        => "402:subscription:Missing required parameter",
            "clientId"     => client_id,
            "subscription" => []
          }
        end
      end
    end

    describe "with an invalid channel" do
      before do
        message["subscription"] = "foo"
        engine.should_receive(:client_exists).with(client_id).and_yield true
      end

      it "does not subscribe the client to the channel" do
        engine.should_not_receive(:subscribe)
        server.subscribe(message) {}
      end

      it "returns an unsuccessful response" do
        server.subscribe(message) do |response|
          response.should == {
            "channel"      => "/meta/subscribe",
            "successful"   => false,
            "error"        => "405:foo:Invalid channel",
            "clientId"     => client_id,
            "subscription" => "foo"
          }
        end
      end
    end

    describe "with a /meta/* channel" do
      before do
        message["subscription"] = "/meta/foo"
        engine.should_receive(:client_exists).with(client_id).and_yield true
      end

      it "does not subscribe the client to the channel" do
        engine.should_not_receive(:subscribe)
        server.subscribe(message) {}
      end

      it "returns an unsuccessful response" do
        server.subscribe(message) do |response|
          response.should == {
            "channel"      => "/meta/subscribe",
            "successful"   => false,
            "error"        => "403:/meta/foo:Forbidden channel",
            "clientId"     => client_id,
            "subscription" => "/meta/foo"
          }
        end
      end

      it "subscribes local clients to the channel" do
        engine.should_receive(:subscribe).with(client_id, "/meta/foo")
        server.subscribe(message, true) {}
      end

      it "returns a successful response for local clients" do
        engine.stub(:subscribe)
        server.subscribe(message, true) do |response|
          response.should == {
            "channel"      => "/meta/subscribe",
            "successful"   => true,
            "clientId"     => client_id,
            "subscription" => "/meta/foo"
          }
        end
      end
    end

    describe "with an error" do
      before do
        message["error"] = "invalid"
        engine.should_receive(:client_exists).with(client_id).and_yield true
      end

      it "does not subscribe the client to the channel" do
        engine.should_not_receive(:subscribe)
        server.subscribe(message) {}
      end

      it "returns an unsuccessful response" do
        server.subscribe(message) do |response|
          response.should == {
            "channel"      => "/meta/subscribe",
            "successful"   => false,
            "error"        => "invalid",
            "clientId"     => client_id,
            "subscription" => "/foo"
          }
        end
      end
    end
  end
end
