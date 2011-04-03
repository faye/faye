require "spec_helper"

describe Faye::Server do
  let(:engine) { mock "engine" }
  let(:server) { Faye::Server.new }
  
  before do
    Faye::Engine.stub(:get).and_return engine
    engine.stub(:add_subscriber)
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
  end
  
  describe :connect do
    let(:client_id) { "fakeclientid" }
    let(:message) {{"channel" => "/meta/connect",
                    "clientId" => "fakeclientid",
                    "connectionType" => "long-polling"
                  }}
    
    describe "with valid paramters" do
      before do
        engine.should_receive(:client_exists).with(client_id).and_yield true
      end
      
      it "pings the engine to say the client is active" do
        engine.should_receive(:ping).with(client_id)
        server.connect(message) {}
      end
      
      it "returns a successful response" do
        engine.stub(:ping)
        server.connect(message) do |response|
          response.should == {
            "channel"    => "/meta/connect",
            "successful" => true,
            "clientId"   => client_id
          }
        end
      end
      
      describe "with a message id" do
        before { message["id"] = "foo" }
        
        it "returns the same id" do
          engine.stub(:ping)
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
      
      it "does not ping the engine" do
        engine.should_not_receive(:ping)
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
      
      it "does not ping the engine" do
        engine.should_not_receive(:ping)
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
      
      it "does not ping the engine" do
        engine.should_not_receive(:ping)
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
            "subscription" => ["/foo"]
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
              "subscription" => ["/foo/**"]
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
            "subscription" => ["/foo"]
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
            "subscription" => ["/foo"]
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
            "subscription" => ["foo"]
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
            "subscription" => ["/meta/foo"]
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
            "subscription" => ["/meta/foo"]
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
            "subscription" => ["/foo"]
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
              "subscription" => ["/foo/**"]
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
            "subscription" => ["/foo"]
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
            "subscription" => ["/foo"]
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
            "subscription" => ["foo"]
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
            "subscription" => ["/meta/foo"]
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
            "subscription" => ["/meta/foo"]
          }
        end
      end
    end
  end
end
