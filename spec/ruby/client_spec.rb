require "spec_helper"

describe Faye::Client do
  let :transport do
    transport = mock("transport")
    transport.stub(:connection_type).and_return "fake"
    transport.stub(:send)
    transport
  end
  
  before { EM.stub(:add_timer) }
  
  def stub_response(response)
    transport.stub(:send) do |message|
      response["id"] = message["id"]
      @client.receive_message(response)
    end
  end

  def create_client
    Faye::Transport.stub(:get).and_return(transport)
    @client = Faye::Client.new("http://localhost/")
  end
  
  def create_connected_client
    create_client
    stub_response "channel"    => "/meta/handshake",
                  "successful" => true,
                  "version"    => "1.0",
                  "supportedConnectionTypes" => ["websocket"],
                  "clientId"   => "fakeid"
    
    @client.handshake
  end
  
  def subscribe(client, channel, callback = nil)
    stub_response "channel"      => "/meta/subscribe",
                  "successful"   => true,
                  "clientId"     => "fakeid",
                  "subscription" => channel
    
    @subs_called = 0
    callback ||= lambda { |m| @subs_called = 1 }
    @client.subscribe(channel, &callback)
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

    describe "with an outgoing extension installed" do
      before do
        extension = Class.new do
          def outgoing(message, callback)
            message["ext"] = {"auth" => "password"}
            callback.call(message)
          end
        end
        @client.add_extension(extension.new)
      end
      
      it "passes the handshake message through the extension" do
        transport.should_receive(:send).with({
          "channel" => "/meta/handshake",
          "version" => "1.0",
          "supportedConnectionTypes" => ["fake"],
          "id"      => instance_of(String),
          "ext"     => {"auth" => "password"}
        }, 60)
        @client.handshake
      end
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
        @client.should_receive(:subscribe).with([], true)
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
    
    describe "with existing subscriptions after a server restart" do
      before do
        create_connected_client
        
        @message = nil
        subscribe @client, "/messages/foo", lambda { |m| @message = m }
        
        @client.receive_message "advice" => {"reconnect" => "handshake"}
        
        stub_response "channel"    => "/meta/handshake",
                      "successful" => true,
                      "version"    => "1.0",
                      "supportedConnectionTypes" => ["websocket"],
                      "clientId"   => "reconnectid"
      end
      
      it "resends the subscriptions to the server" do
        transport.should_receive(:send).with(hash_including("channel" => "/meta/handshake"), 60)
        transport.should_receive(:send).with({
          "channel"      => "/meta/subscribe",
          "clientId"     => "reconnectid",
          "subscription" => "/messages/foo",
          "id"           => instance_of(String)
        }, 60)
        @client.handshake
      end
      
      it "retains the listeners for the subscriptions" do
        @client.handshake
        @client.receive_message("channel" => "/messages/foo", "data" => "ok")
        @message.should == "ok"
      end
    end
    
    describe "with a connected client" do
      before { create_connected_client }
      
      it "does not send a handshake message to the server" do
        transport.should_not_receive(:send).with({
          "channel" => "/meta/handshake",
          "version" => "1.0",
          "supportedConnectionTypes" => ["fake"],
          "id"      => instance_of(String)
        }, 60)
        @client.handshake
      end
    end
  end
  
  describe :connect do
    describe "with an unconnected client" do
      before do
        stub_response "channel"    => "/meta/handshake",
                      "successful" => true,
                      "version"    => "1.0",
                      "supportedConnectionTypes" => ["websocket"],
                      "clientId"   => "handshakeid"
        
        create_client
      end
      
      it "handshakes before connecting" do
        transport.should_receive(:send).with({
          "channel"        => "/meta/connect",
          "clientId"       => "handshakeid",
          "connectionType" => "fake",
          "id"             => instance_of(String)
        }, 60)
        @client.connect
      end
    end
    
    describe "with a connected client" do
      before { create_connected_client }
      
      it "sends a connect message to the server" do
        transport.should_receive(:send).with({
          "channel"        => "/meta/connect",
          "clientId"       => "fakeid",
          "connectionType" => "fake",
          "id"             => instance_of(String)
        }, 60)
        @client.connect
      end
      
      it "only opens one connect request at a time" do
        transport.should_receive(:send).with({
          "channel"        => "/meta/connect",
          "clientId"       => "fakeid",
          "connectionType" => "fake",
          "id"             => instance_of(String)
        }, 60).
        exactly(1).
        and_return # override stub implementation
        
        @client.connect
        @client.connect
      end
    end
  end
  
  describe :disconnect do
    before { create_connected_client }
    
    it "sends a disconnect message to the server" do
      transport.should_receive(:send).with({
        "channel"  => "/meta/disconnect",
        "clientId" => "fakeid",
        "id"       => instance_of(String)
      }, 60)
      @client.disconnect
    end
    
    it "puts the client in the DISCONNECTED state" do
      @client.disconnect
      @client.state.should == :DISCONNECTED
    end
  end
  
  describe :subscribe do
    before do
      create_connected_client
      @subscribe_message = {
          "channel"      => "/meta/subscribe",
          "clientId"     => "fakeid",
          "subscription" => "/foo/*",
          "id"           => instance_of(String)
        }
    end
    
    describe "with no prior subscriptions" do
      it "sends a subscribe message to the server" do
        transport.should_receive(:send).with(@subscribe_message, 60)
        @client.subscribe("/foo/*")
      end
      
      # The Bayeux spec says the server should accept a list of subscriptions
      # in one message but the cometD server doesn't actually support this
      it "sends multiple subscribe messages if given an array" do
        transport.should_receive(:send).with({
          "channel"      => "/meta/subscribe",
          "clientId"     => "fakeid",
          "subscription" => "/foo",
          "id"           => instance_of(String)
        }, 60)
        transport.should_receive(:send).with({
          "channel"      => "/meta/subscribe",
          "clientId"     => "fakeid",
          "subscription" => "/bar",
          "id"           => instance_of(String)
        }, 60)
        @client.subscribe(["/foo", "/bar"])
      end
      
      describe "on successful response" do
        before do
          stub_response "channel"      => "/meta/subscribe",
                        "successful"   => true,
                        "clientId"     => "fakeid",
                        "subscription" => "/foo/*"
        end
        
        it "sets up a listener for the subscribed channel" do
          @message = nil
          @client.subscribe("/foo/*") { |m| @message = m }
          @client.receive_message("channel" => "/foo/bar", "data" => "hi")
          @message.should == "hi"
        end
        
        it "does not call the listener for non-matching channels" do
          @message = nil
          @client.subscribe("/foo/*") { |m| @message = m }
          @client.receive_message("channel" => "/bar", "data" => "hi")
          @message.should be_nil
        end
        
        it "activates the subscription" do
          active = false
          @client.subscribe("/foo/*").callback { active = true }
          active.should be_true
        end
      end
      
      describe "on unsuccessful response" do
        before do
          stub_response "channel"      => "/meta/subscribe",
                        "successful"   => false,
                        "clientId"     => "fakeid",
                        "subscription" => "/foo/*"
        end
        
        it "does not set up a listener for the subscribed channel" do
          @message = nil
          @client.subscribe("/foo/*") { |m| @message = m }
          @client.receive_message("channel" => "/foo/bar", "data" => "hi")
          @message.should be_nil
        end
        
        it "does not activate the subscription" do
          active = false
          @client.subscribe("/foo/*").callback { active = true }
          active.should be_false
        end
      end
    end
    
    describe "with an existing subscription" do
      before do
        subscribe @client, "/foo/*"
      end
      
      it "does not send another subscribe message to the server" do
        transport.should_not_receive(:send).with(@subscribe_message, 60)
        @client.subscribe("/foo/*")
      end
      
      it "sets up another listener on the channel" do
        @client.subscribe("/foo/*") { @subs_called += 1 }
        @client.receive_message("channel" => "/foo/bar", "data" => "hi")
        @subs_called.should == 2
      end
      
      it "activates the subscription" do
        active = false
        @client.subscribe("/foo/*").callback { active = true }
        active.should be_true
      end
    end
  end
  
  describe :unsubscribe do
    before do
      create_connected_client
      @unsubscribe_message = {
          "channel"      => "/meta/unsubscribe",
          "clientId"     => "fakeid",
          "subscription" => "/foo/*",
          "id"           => instance_of(String)
        }
    end
    
    describe "with no subscriptions" do
      it "does not send an unsubscribe message to the server" do
        transport.should_not_receive(:send).with(@unsubscribe_message, 60)
        @client.unsubscribe("/foo/*")
      end
    end
    
    describe "with a single subscription" do
      before do
        @message = nil
        @listener = lambda { |m| @message = m }
        subscribe @client, "/foo/*", @listener
      end
      
      it "sends an unsubscribe message to the server" do
        transport.should_receive(:send).with(@unsubscribe_message, 60)
        @client.unsubscribe("/foo/*")
      end
      
      it "removes the listener from the channel" do
        @client.receive_message("channel" => "/foo/bar", "data" => "first")
        @client.unsubscribe("/foo/*", &@listener)
        @client.receive_message("channel" => "/foo/bar", "data" => "second")
        @message.should == "first"
      end
    end
    
    describe "with multiple subscriptions to the same channel" do
      before do
        @messages = []
        @hey = lambda { |m| @messages << ("hey " + m["text"]) }
        @bye = lambda { |m| @messages << ("bye " + m["text"]) }
        subscribe @client, "/foo/*", @hey
        subscribe @client, "/foo/*", @bye
      end
      
      it "removes one of the listeners from the channel" do
        @client.receive_message("channel" => "/foo/bar", "data" => {"text" => "you"})
        @client.unsubscribe("/foo/*", &@hey)
        @client.receive_message("channel" => "/foo/bar", "data" => {"text" => "you"})
        @messages.should == ["hey you", "bye you", "bye you"]
      end
      
      it "does not send an unsubscribe message if one listener is removed" do
        transport.should_not_receive(:send).with(@unsubscribe_message, 60)
        @client.unsubscribe("/foo/*", &@bye)
      end
      
      it "sends an unsubscribe message if each listener is removed" do
        transport.should_receive(:send).with(@unsubscribe_message, 60)
        @client.unsubscribe("/foo/*", &@bye)
        @client.unsubscribe("/foo/*", &@hey)
      end
      
      it "sends an unsubscribe message if all listeners are removed" do
        transport.should_receive(:send).with(@unsubscribe_message, 60)
        @client.unsubscribe("/foo/*")
      end
    end
    
    describe "with multiple subscriptions to different channels" do
      before do
        subscribe @client, "/foo"
        subscribe @client, "/bar"
      end
      
      it "sends multiple unsubscribe messages if given an array" do
        transport.should_receive(:send).with({
          "channel"      => "/meta/unsubscribe",
          "clientId"     => "fakeid",
          "subscription" => "/foo",
          "id"           => instance_of(String)
        }, 60)
        transport.should_receive(:send).with({
          "channel"      => "/meta/unsubscribe",
          "clientId"     => "fakeid",
          "subscription" => "/bar",
          "id"           => instance_of(String)
        }, 60)
        @client.unsubscribe(["/foo", "/bar"])
      end
    end
  end
  
  describe :publish do
    before { create_connected_client }
    
    it "sends the message to the server with an ID" do
      transport.should_receive(:send).with({
        "channel"  => "/messages/foo",
        "clientId" => "fakeid",
        "data"     => {"hello" => "world"},
        "id"       => instance_of(String)
      }, 60)
      @client.publish("/messages/foo", "hello" => "world")
    end
    
    describe "with an outgoing extension installed" do
      before do
        extension = Class.new do
          def outgoing(message, callback)
            message["ext"] = {"auth" => "password"}
            callback.call(message)
          end
        end
        @client.add_extension(extension.new)
      end
      
      it "passes messages through the extension" do
        transport.should_receive(:send).with({
          "channel"  => "/messages/foo",
          "clientId" => "fakeid",
          "data"     => {"hello" => "world"},
          "id"       => instance_of(String),
          "ext"      => {"auth" => "password"}
        }, 60)
        @client.publish("/messages/foo", "hello" => "world")
      end
    end
    
    describe "with an incoming extension installed" do
      before do
        extension = Class.new do
          def incoming(message, callback)
            message["ext"] = {"auth" => "password"}
            callback.call(message)
          end
        end
        @client.add_extension(extension.new)
      end
      
      it "leaves the message unchanged" do
        transport.should_receive(:send).with({
          "channel"  => "/messages/foo",
          "clientId" => "fakeid",
          "data"     => {"hello" => "world"},
          "id"       => instance_of(String)
        }, 60)
        @client.publish("/messages/foo", "hello" => "world")
      end
    end
  end
end
