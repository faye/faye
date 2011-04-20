require "spec_helper"

describe Faye::Server do
  let(:engine) { mock "engine" }
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
      response.should == []
    end
    
    it "routes single messages to appropriate handlers" do
      server.should_receive(:handshake).with(handshake, false)
      engine.should_receive(:publish).with(handshake)
      server.process(handshake, false)
    end
    
    it "routes a list of messages to appropriate handlers" do
      server.should_receive(:handshake).with(handshake, false)
      server.should_receive(:connect).with(connect, false)
      server.should_receive(:disconnect).with(disconnect, false)
      server.should_receive(:subscribe).with(subscribe, false)
      server.should_receive(:unsubscribe).with(unsubscribe, false)
      
      engine.should_receive(:publish).with(handshake)
      engine.should_receive(:publish).with(connect)
      engine.should_receive(:publish).with(disconnect)
      engine.should_receive(:publish).with(subscribe)
      engine.should_receive(:publish).with(unsubscribe)
      engine.should_receive(:publish).with(publish)
      
      server.process([handshake, connect, disconnect, subscribe, unsubscribe, publish], false)
    end
    
    describe "publishing a message" do
      it "tells the engine to publish the message" do
        engine.should_receive(:publish).with(publish)
        server.process(publish, false) {}
      end
      
      it "returns no response" do
        engine.stub(:publish)
        server.process(publish, false) { |r| r.should == [] }
      end
      
      describe "with an error" do
        before { publish["error"] = "invalid" }
        
        it "does not tell the engine to publish the message" do
          engine.should_not_receive(:publish)
          server.process(publish, false) {}
        end
        
        it "returns no response" do
          engine.stub(:publish)
          server.process(publish, false) { |r| r.should == [] }
        end
      end
    end
    
    describe "handshaking" do
      before do
        engine.should_receive(:publish).with(handshake)
        server.should_receive(:handshake).with(handshake, false).and_yield({"successful" => true})
      end
      
      it "returns the handshake response with advice" do
        server.process(handshake, false) do |response|
          response.should == [
            { "successful" => true,
              "advice" => {"reconnect" => "retry", "interval" => 0, "timeout" => 60000}
            }
          ]
        end
      end
    end
    
    describe "connecting for messages" do
      let(:messages) { [{"channel" => "/a"}, {"channel" => "/b"}] }
      
      before do
        engine.should_receive(:publish).with(connect)
        server.should_receive(:connect).with(connect, false).and_yield(messages)
      end
      
      it "returns the new messages" do
        server.process(connect, false) { |r| r.should == messages }
      end
    end
  end
  
  describe :handshake do
    let(:message) {{"channel" => "/meta/handshake",
                    "version" => "1.0",
                    "supportedConnectionTypes" => ["long-polling"]
                  }}
    
    describe "with valid parameters" do
      it "creates a client" do
        engine.should_receive(:create_client)
        server.handshake(message) {}
      end
      
      it "returns a successful response" do
        engine.stub(:create_client).and_yield "clientid"
        server.handshake(message) do |response|
          response.should == {
            "channel"    => "/meta/handshake",
            "successful" => true,
            "version"    => "1.0",
            "supportedConnectionTypes" => ["long-polling","cross-origin-long-polling","callback-polling","websocket"],
            "clientId"   => "clientid"
          }
        end
      end
      
      describe "with a message id" do
        before { message["id"] = "foo" }
        
        it "returns the same id" do
          engine.stub(:create_client).and_yield "clientid"
          server.handshake(message) do |response|
            response.should == {
              "channel"    => "/meta/handshake",
              "successful" => true,
              "version"    => "1.0",
              "supportedConnectionTypes" => ["long-polling","cross-origin-long-polling","callback-polling","websocket"],
              "clientId"   => "clientid",
              "id"         => "foo"
            }
          end
        end
      end
    end
    
    describe "missing version" do
      before { message.delete "version" }
      
      it "does not create a client" do
        engine.should_not_receive(:create_client)
        server.handshake(message) {}
      end
      
      it "returns an unsuccessful response" do
        server.handshake(message) do |response|
          response.should == {
            "channel"    => "/meta/handshake",
            "successful" => false,
            "error"      => "402:version:Missing required parameter",
            "version"    => "1.0",
            "supportedConnectionTypes" => ["long-polling","cross-origin-long-polling","callback-polling","websocket"]
          }
        end
      end
    end
    
    describe "missing supportedConnectionTypes" do
      before { message.delete "supportedConnectionTypes" }
      
      it "does not create a client" do
        engine.should_not_receive(:create_client)
        server.handshake(message) {}
      end
      
      it "returns an unsuccessful response" do
        server.handshake(message) do |response|
          response.should == {
            "channel"    => "/meta/handshake",
            "successful" => false,
            "error"      => "402:supportedConnectionTypes:Missing required parameter",
            "version"    => "1.0",
            "supportedConnectionTypes" => ["long-polling","cross-origin-long-polling","callback-polling","websocket"]
          }
        end
      end
      
      it "returns a successful response for local clients" do
        engine.stub(:create_client).and_yield "clientid"
        server.handshake(message, true) do |response|
          response.should == {
            "channel"    => "/meta/handshake",
            "successful" => true,
            "version"    => "1.0",
            "clientId"   => "clientid"
          }
        end
      end
    end
    
    describe "with no matching supportedConnectionTypes" do
      before { message["supportedConnectionTypes"] = ["iframe", "flash"] }
      
      it "does not create a client" do
        engine.should_not_receive(:create_client)
        server.handshake(message) {}
      end
      
      it "returns an unsuccessful response" do
        server.handshake(message) do |response|
          response.should == {
            "channel"    => "/meta/handshake",
            "successful" => false,
            "error"      => "301:iframe,flash:Connection types not supported",
            "version"    => "1.0",
            "supportedConnectionTypes" => ["long-polling","cross-origin-long-polling","callback-polling","websocket"]
          }
        end
      end
    end
    
    describe "with an error" do
      before { message["error"] = "invalid" }
      
      it "does not createa a client" do
        engine.should_not_receive(:create_client)
        server.handshake(message) {}
      end
      
      it "returns an unsuccessful response" do
        server.handshake(message) do |response|
          response.should == {
            "channel"    => "/meta/handshake",
            "successful" => false,
            "error"      => "invalid",
            "version"    => "1.0",
            "supportedConnectionTypes" => ["long-polling","cross-origin-long-polling","callback-polling","websocket"]
          }
        end
      end
    end
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
    
    # TODO fail if connectionType is not recognized
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
  
  describe :unsubscribe do
    let(:client_id) { "fakeclientid" }
    let(:message) {{"channel" => "/meta/unsubscribe",
                    "clientId" => "fakeclientid",
                    "subscription" => "/foo"
                  }}
    
    describe "with valid parameters" do
      before do
        engine.should_receive(:client_exists).with(client_id).and_yield true
      end
      
      it "unsubscribes the client from the channel" do
        engine.should_receive(:unsubscribe).with(client_id, "/foo")
        server.unsubscribe(message) {}
      end
      
      it "returns a successful response" do
        engine.stub(:unsubscribe)
        server.unsubscribe(message) do |response|
          response.should == {
            "channel"      => "/meta/unsubscribe",
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
        
        it "destroys multiple subscriptions" do
          engine.should_receive(:unsubscribe).with(client_id, "/foo")
          engine.should_receive(:unsubscribe).with(client_id, "/bar")
          server.unsubscribe(message) {}
        end
        
        it "returns a successful response" do
          engine.stub(:unsubscribe)
          server.unsubscribe(message) do |response|
            response.should == {
              "channel"      => "/meta/unsubscribe",
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
        
        it "destroys the subscription to the channel pattern" do
          engine.should_receive(:unsubscribe).with(client_id, "/foo/**")
          server.unsubscribe(message) {}
        end
        
        it "returns a successful response" do
          engine.stub(:unsubscribe)
          server.unsubscribe(message) do |response|
            response.should == {
              "channel"      => "/meta/unsubscribe",
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
      
      it "does not unsubscribe the client from the channel" do
        engine.should_not_receive(:unsubscribe)
        server.unsubscribe(message) {}
      end
      
      it "returns an unsuccessful response" do
        server.unsubscribe(message) do |response|
          response.should == {
            "channel"      => "/meta/unsubscribe",
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
      
      it "does not unsubscribe the client from the channel" do
        engine.should_not_receive(:unsubscribe)
        server.unsubscribe(message) {}
      end
      
      it "returns an unsuccessful response" do
        server.unsubscribe(message) do |response|
          response.should == {
            "channel"      => "/meta/unsubscribe",
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
      
      it "does not unsubscribe the client from the channel" do
        engine.should_not_receive(:unsubscribe)
        server.unsubscribe(message) {}
      end
      
      it "returns an unsuccessful response" do
        server.unsubscribe(message) do |response|
          response.should == {
            "channel"      => "/meta/unsubscribe",
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
      
      it "does not unsubscribe the client from the channel" do
        engine.should_not_receive(:unsubscribe)
        server.unsubscribe(message) {}
      end
      
      it "returns an unsuccessful response" do
        server.unsubscribe(message) do |response|
          response.should == {
            "channel"      => "/meta/unsubscribe",
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
      
      it "does not unsubscribe the client from the channel" do
        engine.should_not_receive(:unsubscribe)
        server.unsubscribe(message) {}
      end
      
      it "returns an unsuccessful response" do
        server.unsubscribe(message) do |response|
          response.should == {
            "channel"      => "/meta/unsubscribe",
            "successful"   => false,
            "error"        => "403:/meta/foo:Forbidden channel",
            "clientId"     => client_id,
            "subscription" => "/meta/foo"
          }
        end
      end
      
      it "unsubscribes local clients from the channel" do
        engine.should_receive(:unsubscribe).with(client_id, "/meta/foo")
        server.unsubscribe(message, true) {}
      end
      
      it "returns a successful response for local clients" do
        engine.stub(:unsubscribe)
        server.unsubscribe(message, true) do |response|
          response.should == {
            "channel"      => "/meta/unsubscribe",
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
      
      it "does not unsubscribe the client from the channel" do
        engine.should_not_receive(:unsubscribe)
        server.unsubscribe(message) {}
      end
      
      it "returns an unsuccessful response" do
        server.unsubscribe(message) do |response|
          response.should == {
            "channel"      => "/meta/unsubscribe",
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
