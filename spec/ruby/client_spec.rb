require "spec_helper"

describe Faye::Client do
  let :transport do
    transport = Object.new
    transport.stub(:connection_type).and_return "fake"
    transport
  end

  def create_client
    Faye::Transport.stub(:get).and_return(transport)
    @client = Faye::Client.new("http://localhost/")
  end

  def stub_response(response)
    transport.stub(:send) do |message|
      response["id"] = message["id"]
      @client.receive_message(response)
    end
  end

  describe :initialize do
    it "creates a transport the server must support" do
      Faye::Transport.should_receive(:get).with(instance_of(Faye::Client),
                                                ["long-polling", "callback-polling", "in-process"]).
                                           and_return(transport)
      Faye::Client.new("http://localhost/")
    end

    it "puts the client in the UNCONNECTED state" do
      Faye::Transport.stub(:get)
      client = Faye::Client.new("http://localhost/")
      client.state.should == :UNCONNECTED
    end
  end

  describe :handshake do
    before { create_client }

    it "sends a handshake message to the server" do
      transport.should_receive(:send).with({
        "channel" => "/meta/handshake",
        "version" => "1.0",
        "supportedConnectionTypes" => ["fake"],
        "id"      => instance_of(String)
      }, 60)
      @client.handshake
    end

    it "puts the client in the CONNECTING state" do
      transport.stub(:send)
      @client.handshake
      @client.state.should == :CONNECTING
    end

    describe "on successful response" do
      before do
        stub_response "channel"    => "/meta/handshake",
                      "successful" => true,
                      "version"    => "1.0",
                      "supportedConnectionTypes" => ["websocket"],
                      "clientId"   => "fakeid"
      end

      it "stores the clientId" do
        @client.handshake
        @client.client_id.should == "fakeid"
      end

      it "puts the client in the CONNECTED state" do
        @client.handshake
        @client.state.should == :CONNECTED
      end

      it "selects a new transport based on what the server supports" do
        Faye::Transport.should_receive(:get).with(instance_of(Faye::Client), ["websocket"]).
                                             and_return(transport)
        @client.handshake
      end

      it "registers any pre-existing subscriptions" do
        @client.should_receive(:subscribe).with([])
        @client.handshake
      end
    end

    describe "on unsuccessful response" do
      before do
        stub_response "channel"    => "/meta/handshake",
                      "successful" => false,
                      "version"    => "1.0",
                      "supportedConnectionTypes" => ["websocket"]
      end

      it "schedules a retry" do
        EM.should_receive(:add_timer)
        @client.handshake
      end

      it "puts the client in the UNCONNECTED state" do
        EM.stub(:add_timer)
        @client.handshake
        @client.state.should == :UNCONNECTED
      end
    end
  end
end
