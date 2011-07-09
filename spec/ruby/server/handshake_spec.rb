require "spec_helper"

describe "server handshake" do
  let(:engine) { mock "engine" }
  let(:server) { Faye::Server.new %w[long-polling] }
  
  before do
    Faye::Engine.stub(:get).and_return engine
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
            "supportedConnectionTypes" => ["long-polling"],
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
              "supportedConnectionTypes" => ["long-polling"],
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
            "supportedConnectionTypes" => ["long-polling"]
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
            "supportedConnectionTypes" => ["long-polling"]
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
            "supportedConnectionTypes" => ["long-polling"]
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
            "supportedConnectionTypes" => ["long-polling"]
          }
        end
      end
    end
  end  
end
