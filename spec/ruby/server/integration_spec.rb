# encoding=utf-8

require "spec_helper"

IntegrationSteps = RSpec::EM.async_steps do
  class Tagger
    def incoming(message, callback)
      message["data"]["tagged"] = true if message["data"]
      callback.call(message)
    end

    def outgoing(message, request, callback)
      message["data"]["url"] = request.path_info if message["data"]
      callback.call(message)
    end
  end

  def server(port, &callback)
    @faye = Faye::RackAdapter.new(:mount => "/bayeux", :timeout => 25)
    @faye.add_extension(Tagger.new)

    @server = ServerProxy::App.new(@faye)
    @port   = port

    @server.listen(@port)
    EM.next_tick(&callback)
  end

  def stop(&callback)
    @server.stop
    EM.next_tick(&callback)
  end

  def client(name, channels, &callback)
    @clients       ||= {}
    @inboxes       ||= {}
    @clients[name]   = Faye::Client.new("http://localhost:#{@port}/bayeux")
    @inboxes[name]   = {}

    n = channels.size
    return @clients[name].connect(&callback) if n.zero?

    channels.each do |channel|
      subscription = @clients[name].subscribe(channel) do |message|
        @inboxes[name][channel] ||= []
        @inboxes[name][channel] << message
      end
      subscription.callback do
        n -= 1
        callback.call if n.zero?
      end
    end
  end

  def publish(name, channel, message, &callback)
    @clients[name].publish(channel, message)
    EM.add_timer(0.1, &callback)
  end

  def check_inbox(name, channel, messages, &callback)
    inbox = @inboxes[name][channel] || []
    inbox.should == messages
    callback.call
  end
end

describe "server integration" do
  next if RUBY_PLATFORM =~ /java/

  include IntegrationSteps
  include EncodingHelper

  before do
    server 4180
    client :alice, []
    client :bob,   ["/foo"]
  end

  after { stop }

  shared_examples_for "message bus" do
    it "delivers a message between clients" do
      publish :alice, "/foo", {"hello" => "world", "extra" => nil}
      check_inbox :bob, "/foo", [{"hello" => "world", "extra" => nil, "tagged" => true, "url" => "/bayeux"}]
    end

    it "does not deliver messages for unsubscribed channels" do
      publish :alice, "/bar", {"hello" => "world"}
      check_inbox :bob, "/foo", []
    end

    it "delivers multiple messages" do
      publish :alice, "/foo", {"hello" => "world"}
      publish :alice, "/foo", {"hello" => "world"}
      check_inbox :bob, "/foo", [{"hello" => "world", "tagged" => true, "url" => "/bayeux"}, {"hello" => "world", "tagged" => true, "url" => "/bayeux"}]
    end

    it "delivers multibyte strings" do
      publish :alice, "/foo", {"hello" => encode("Apple = "), "tagged" => true, "url" => "/bayeux"}
      check_inbox :bob, "/foo", [{"hello" => encode("Apple = "), "tagged" => true, "url" => "/bayeux"}]
    end
  end

  shared_examples_for "network transports" do
    describe "with HTTP transport" do
      before do
        Faye::Transport::WebSocket.stub(:usable?).and_yield(false)
      end

      it_should_behave_like "message bus"
    end

    describe "with WebSocket transport" do
      before do
        Faye::Transport::WebSocket.stub(:usable?).and_yield(true)
      end

      it_should_behave_like "message bus"
    end
  end

  describe "with HTTP server" do
    let(:server_options) { {:ssl => false} }
    it_should_behave_like "network transports"
  end
end
