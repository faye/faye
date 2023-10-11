require "spec_helper"

describe Faye::RackAdapter do
  include Rack::Test::Methods

  let(:adapter)  { Faye::RackAdapter.new(settings) { |ra| @yielded = ra } }
  let(:app)      { ServerProxy.new(adapter) }
  let(:settings) { { :mount => "/bayeux", :timeout => 30 } }
  let(:server)   { double "server" }

  after { app.stop }

  let(:content_type) { last_response["Content-Type"] }
  let(:json)         { MultiJson.load(body) }
  let(:body)         { last_response.body }
  let(:status)       { last_response.status.to_i }

  def headers(name)
    last_response[name]
  end

  before do
    Faye::Server.should_receive(:new).with(settings).and_return server
    adapter.stub(:get_client).and_return double("client")
  end

  describe "monitoring configuration" do
    it "should be possible by providing a block to initializer" do
      @yielded.should be_instance_of(Faye::RackAdapter)
    end
  end

  describe "OPTIONS requests" do
    describe "with origin specified" do
      before { header "Origin", "http://example.com" }

      it "returns a matching cross-origin access control header" do
        options "/bayeux"
        headers("Access-Control-Allow-Origin").should == "http://example.com"
        headers("Access-Control-Allow-Credentials").should == "true"
        headers("Access-Control-Allow-Headers").should == "Accept, Authorization, Content-Type, Pragma, X-Requested-With"
        headers("Access-Control-Allow-Methods").should == "POST, GET"
        headers("Access-Control-Max-Age").should == "86400"
      end
    end

    describe "with referer specified" do
      before { header "Referer", "http://example.com" }

      it "returns a matching cross-origin access control header" do
        options "/bayeux"
        headers("Access-Control-Allow-Origin").should == "http://example.com"
        headers("Access-Control-Allow-Credentials").should == "true"
        headers("Access-Control-Allow-Headers").should == "Accept, Authorization, Content-Type, Pragma, X-Requested-With"
        headers("Access-Control-Allow-Methods").should == "POST, GET"
        headers("Access-Control-Max-Age").should == "86400"
      end
    end

    describe "with no origin specified" do
      it "returns a wildcard cross-origin access control header" do
        options "/bayeux"
        headers("Access-Control-Allow-Origin").should == "*"
        headers("Access-Control-Allow-Credentials").should == "true"
        headers("Access-Control-Allow-Headers").should == "Accept, Authorization, Content-Type, Pragma, X-Requested-With"
        headers("Access-Control-Allow-Methods").should == "POST, GET"
        headers("Access-Control-Max-Age").should == "86400"
      end
    end
  end

  describe "POST requests" do
    describe "with cross-origin access control" do
      shared_examples_for "cross-origin request" do
        before do
          header "Origin", "http://example.com"
        end

        it "returns a matching cross-origin access control header" do
          server.stub(:process).and_yield []
          post "/bayeux", :message => '[]'
          headers("Access-Control-Allow-Origin").should == "http://example.com"
        end

        it "forwards the message param onto the server" do
          server.should_receive(:process).with({ "channel" => "/plain" }, instance_of(Rack::Request)).and_yield []
          post "/bayeux", "message=%7B%22channel%22%3A%22%2Fplain%22%7D"
        end

        it "returns the server's response as JSON" do
          server.stub(:process).and_yield ["channel" => "/meta/handshake"]
          post "/bayeux", "message=%5B%5D"
          status.should == 200
          content_type.should == "application/json; charset=utf-8"
          headers("Content-Length").should == "31"
          json.should == ["channel" => "/meta/handshake"]
        end

        it "returns a 400 response if malformed JSON is given" do
          server.should_not_receive(:process)
          post "/bayeux", "message=%7B%5B"
          status.should == 400
          content_type.should == "text/plain; charset=utf-8"
        end

        it "returns a 400 response if primitive JSON is given" do
          server.should_not_receive(:process)
          post "/bayeux", "message=1"
          status.should == 400
          content_type.should == "text/plain; charset=utf-8"
        end

        it "returns a 404 if the path is not matched" do
          server.should_not_receive(:process)
          post "/blaf", 'message=%5B%5D'
          status.should == 404
          content_type.should == "text/plain; charset=utf-8"
        end
      end

      describe "with text/plain" do
        before { header "Content-Type", "text/plain" }
        it_should_behave_like "cross-origin request"
      end

      describe "with application/xml" do
        before { header "Content-Type", "application/xml" }
        it_should_behave_like "cross-origin request"
      end
    end

    describe "with application/json" do
      before do
        header "Content-Type", "application/json"
      end

      it "does not return an access control header" do
        server.stub(:process).and_yield []
        post "/bayeux", :message => '[]'
        headers("Access-Control-Allow-Origin").should be_nil
      end

      it "forwards the POST body onto the server" do
        server.should_receive(:process).with({ "channel" => "/foo" }, instance_of(Rack::Request)).and_yield []
        post "/bayeux", '{ "channel":"/foo" }'
      end

      it "returns the server's response as JSON" do
        server.stub(:process).and_yield ["channel" => "/meta/handshake"]
        post "/bayeux", '[]'
        status.should == 200
        content_type.should == "application/json; charset=utf-8"
          headers("Content-Length").should == "31"
        json.should == ["channel" => "/meta/handshake"]
      end

      it "returns a 400 response if malformed JSON is given" do
        server.should_not_receive(:process)
        post "/bayeux", "[ }"
        status.should == 400
        content_type.should == "text/plain; charset=utf-8"
      end

      it "returns a 404 if the path is not matched" do
        server.should_not_receive(:process)
        post "/blaf", "[]"
        status.should == 404
        content_type.should == "text/plain; charset=utf-8"
      end
    end

    describe "with no content type" do
      it "forwards the message param onto the server" do
        server.should_receive(:process).with({ "channel" => "/foo" }, instance_of(Rack::Request)).and_yield []
        post "/bayeux", :message => '{ "channel":"/foo" }'
      end

      it "returns the server's response as JSON" do
        server.stub(:process).and_yield ["channel" => "/meta/handshake"]
        post "/bayeux", :message => '[]'
        status.should == 200
        content_type.should == "application/json; charset=utf-8"
        headers("Content-Length").should == "31"
        json.should == ["channel" => "/meta/handshake"]
      end

      it "returns a 400 response if malformed JSON is given" do
        server.should_not_receive(:process)
        post "/bayeux", :message => "[ }"
        status.should == 400
        content_type.should == "text/plain; charset=utf-8"
      end

      it "returns a 404 if the path is not matched" do
        server.should_not_receive(:process)
        post "/blaf", :message => "[]"
        status.should == 404
        content_type.should == "text/plain; charset=utf-8"
      end
    end
  end

  describe "GET requests" do
    let(:params) { { :message => '{ "channel":"/foo" }', :jsonp => "callback" } }

    describe "with valid params" do
      it "forwards the message param onto the server" do
        server.should_receive(:process).with({ "channel" => "/foo" }, instance_of(Rack::Request)).and_yield []
        get "/bayeux", params
      end

      it "returns the server's response as JavaScript" do
        server.stub(:process).and_yield ["channel" => "/meta/handshake"]
        get "/bayeux", params
        status.should == 200
        content_type.should == "text/javascript; charset=utf-8"
        headers("Content-Length").should == "46"
        body.should == '/**/callback([{"channel":"/meta/handshake"}]);'
      end

      it "does not let the client cache the response" do
        server.stub(:process).and_yield ["channel" => "/meta/handshake"]
        get "/bayeux", params
        headers("Cache-Control").should == "no-cache, no-store"
      end
    end

    describe "with an unknown path" do
      it "returns a 404" do
        server.should_not_receive(:process)
        get "/blah", params
        status.should == 404
        content_type.should == "text/plain; charset=utf-8"
      end
    end

    describe "missing jsonp" do
      before do
        params.delete(:jsonp)
      end

      it "returns the server's response using the default callback" do
        server.stub(:process).and_yield ["channel" => "/meta/handshake"]
        get "/bayeux", params
        status.should == 200
        content_type.should == "text/javascript; charset=utf-8"
        headers("Content-Length").should == "51"
        body.should == '/**/jsonpcallback([{"channel":"/meta/handshake"}]);'
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
        content_type.should == "text/plain; charset=utf-8"
      end
    end

    describe "with malformed JSON" do
      before { params[:message] = "[ }" }
      it_should_behave_like "bad GET request"
    end

    describe "with a callback that's not a JS identifier" do
      before { params[:jsonp] = "42" }
      it_should_behave_like "bad GET request"
    end

    describe "missing message" do
      before { params.delete(:message) }
      it_should_behave_like "bad GET request"
    end
  end
end
