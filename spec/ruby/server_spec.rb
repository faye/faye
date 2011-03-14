require "spec_helper"

describe Faye::Server do
  let(:engine) { Object.new }
  let(:server) { Faye::Server.new }
  
  before do
    Faye::Engine.stub(:get).and_return engine
    engine.stub(:add_subscriber)
  end
  
  it "listens for notifications from Engine" do
    engine.should_receive(:add_subscriber).with(:message, anything)
    engine.should_receive(:add_subscriber).with(:disconnect, anything)
    Faye::Server.new
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
            "supportedConnectionTypes" => ["long-polling","callback-polling","websocket"],
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
              "supportedConnectionTypes" => ["long-polling","callback-polling","websocket"],
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
            "supportedConnectionTypes" => ["long-polling","callback-polling","websocket"]
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
            "supportedConnectionTypes" => ["long-polling","callback-polling","websocket"]
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
            "supportedConnectionTypes" => ["long-polling","callback-polling","websocket"]
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
end
