require "spec_helper"
require "thin_proxy"

describe Faye::RackAdapter do
  include Rack::Test::Methods
  let(:app)     { ThinProxy.new(Faye::RackAdapter.new options) }
  let(:options) { {:mount => "/bayeux", :timeout => 30} }
  let(:server)  { mock "server" }
  
  after { app.stop }
  
  let(:content_type)          { last_response["Content-Type"] }
  let(:access_control_origin) { last_response["Access-Control-Allow-Origin"] }
  let(:json)                  { JSON.parse(body) }
  let(:body)                  { last_response.body }
  let(:status)                { last_response.status.to_i }
  
  before do
    Faye::Server.should_receive(:new).with(options).and_return server
  end
  
  describe "POST requests" do
    describe "with cross-origin access control" do
      before do
        header "Origin", "http://example.com"
      end
      
      it "returns a matching cross-origin access control header" do
        server.stub(:process).and_yield []
        post "/bayeux", :message => '[]'
        access_control_origin.should == "http://example.com"
      end
      
      it "forwards the message param onto the server" do
        server.should_receive(:process).with({"channel" => "/foo"}, false).and_yield []
        post "/bayeux", :message => '{"channel":"/foo"}'
      end
      
      it "returns the server's response as JSON" do
        server.stub(:process).and_yield ["channel" => "/meta/handshake"]
        post "/bayeux", :message => '[]'
        status.should == 200
        content_type.should == "application/json"
        json.should == ["channel" => "/meta/handshake"]
      end
      
      it "returns a 400 response if malformed JSON is given" do
        server.should_not_receive(:process)
        post "/bayeux", :message => "[}"
        status.should == 400
        content_type.should == "text/plain"
      end
      
      it "returns a 404 if the path is not matched" do
        server.should_not_receive(:process)
        post "/blaf", :message => "[]"
        status.should == 404
        content_type.should == "text/plain"
      end
    end
    
    describe "with application/json" do
      before do
        header "Content-Type", "application/json"
      end
      
      it "does not return an access control header" do
        server.stub(:process).and_yield []
        post "/bayeux", :message => '[]'
        access_control_origin.should be_nil
      end
      
      it "forwards the POST body onto the server" do
        server.should_receive(:process).with({"channel" => "/foo"}, false).and_yield []
        post "/bayeux", '{"channel":"/foo"}'
      end
      
      it "returns the server's response as JSON" do
        server.stub(:process).and_yield ["channel" => "/meta/handshake"]
        post "/bayeux", '[]'
        status.should == 200
        content_type.should == "application/json"
        json.should == ["channel" => "/meta/handshake"]
      end
      
      it "returns a 400 response if malformed JSON is given" do
        server.should_not_receive(:process)
        post "/bayeux", "[}"
        status.should == 400
        content_type.should == "text/plain"
      end
      
      it "returns a 404 if the path is not matched" do
        server.should_not_receive(:process)
        post "/blaf", "[]"
        status.should == 404
        content_type.should == "text/plain"
      end
    end
    
    describe "with no content type" do
      it "forwards the message param onto the server" do
        server.should_receive(:process).with({"channel" => "/foo"}, false).and_yield []
        post "/bayeux", :message => '{"channel":"/foo"}'
      end
      
      it "returns the server's response as JSON" do
        server.stub(:process).and_yield ["channel" => "/meta/handshake"]
        post "/bayeux", :message => '[]'
        status.should == 200
        content_type.should == "application/json"
        json.should == ["channel" => "/meta/handshake"]
      end
      
      it "returns a 400 response if malformed JSON is given" do
        server.should_not_receive(:process)
        post "/bayeux", :message => "[}"
        status.should == 400
        content_type.should == "text/plain"
      end
      
      it "returns a 404 if the path is not matched" do
        server.should_not_receive(:process)
        post "/blaf", :message => "[]"
        status.should == 404
        content_type.should == "text/plain"
      end
    end
  end
  
  describe "GET requests" do
    let(:params) {{:message => '{"channel":"/foo"}', :jsonp => "callback"}}
    
    describe "with valid params" do
      before do
        server.should_receive(:flush_connection).with("channel" => "/foo")
      end
      
      it "forwards the message param onto the server" do
        server.should_receive(:process).with({"channel" => "/foo"}, false).and_yield []
        get "/bayeux", params
      end
      
      it "returns the server's response as JavaScript" do
        server.stub(:process).and_yield ["channel" => "/meta/handshake"]
        get "/bayeux", params
        status.should == 200
        content_type.should == "text/javascript"
        body.should == 'callback([{"channel":"/meta/handshake"}]);'
      end
    end
    
    describe "with an unknown path" do
      it "returns a 404" do
        server.should_not_receive(:process)
        get "/blah", params
        status.should == 404
        content_type.should == "text/plain"
      end
    end
    
    describe "missing jsonp" do
      before do
        params.delete(:jsonp)
        server.should_receive(:flush_connection)
      end
      
      it "returns the server's response using the default callback" do
        server.stub(:process).and_yield ["channel" => "/meta/handshake"]
        get "/bayeux", params
        status.should == 200
        content_type.should == "text/javascript"
        body.should == 'jsonpcallback([{"channel":"/meta/handshake"}]);'
      end
    end
    
    shared_examples_for "bad GET request" do
      it "does not call the server" do
        server.should_not_receive(:process)
        get "/bayeux", params
      end
      
      it "returns a 400 response" do
        get "/bayeux", params
        status.should == 400
        content_type.should == "text/plain"
      end
    end
    
    describe "with malformed JSON" do
      before { params[:message] = "[}" }
      it_should_behave_like "bad GET request"
    end
    
    describe "missing message" do
      before { params.delete(:message) }
      it_should_behave_like "bad GET request"
    end
    
    describe "for the client script" do
      it "returns the client script" do
        get "/bayeux.js"
        status.should == 200
        content_type.should == "text/javascript"
        body.should =~ /function\(\)\{/
      end
    end
  end
end
