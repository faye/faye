# encoding=utf-8

root = File.expand_path('../../..', __FILE__)

require 'rspec/em'

require root + '/spec/ruby/encoding_helper'

require root + '/lib/faye/mixins/deferrable'
require root + '/lib/faye/mixins/logging'
require root + '/lib/faye/mixins/publisher'
require root + '/lib/faye/mixins/timeouts'

require root + '/lib/faye/protocol/channel'
require root + '/lib/faye/protocol/grammar'
require root + '/lib/faye/engines/proxy'

EngineSteps = RSpec::EM.async_steps do
  def disconnect_engine(&resume)
    engine.disconnect
    resume.call
  end

  def create_client(name, &resume)
    @inboxes ||= {}
    @clients ||= {}
    engine.create_client do |client_id|
      @clients[name] = client_id
      @inboxes[name] ||= []
      resume.call
    end
  end

  def connect(name, engine, &resume)
    engine.connect(@clients[name]) do |m|
      m.each do |message|
        message.delete("id")
        @inboxes[name] << message
      end
    end
    EM.add_timer(0.1, &resume)
  end

  def destroy_client(name, &resume)
    engine.destroy_client(@clients[name], &resume)
  end

  def check_client_id(name, pattern, &resume)
    @clients[name].should =~ pattern
    resume.call
  end

  def check_num_clients(n, &resume)
    ids = Set.new
    @clients.each { |name,id| ids.add(id) }
    ids.size.should == n
    resume.call
  end

  def check_client_exists(name, exists, &resume)
    engine.client_exists(@clients[name]) do |actual|
      actual.should == exists
      resume.call
    end
  end

  def subscribe(name, channel, &resume)
    engine.subscribe(@clients[name], channel, &resume)
  end

  def unsubscribe(name, channel, &resume)
    engine.unsubscribe(@clients[name], channel, &resume)
  end

  def publish(messages, &resume)
    messages = [messages].flatten
    messages.each do |message|
      message = {"id" => Faye::Engine.random}.merge(message)
      engine.publish(message)
    end
    EM.add_timer(0.1, &resume)
  end

  def publish_by(name, message, &resume)
    message = {"clientId" => @clients[name], "id" => Faye::Engine.random}.merge(message)
    engine.publish(message)
    EM.add_timer(0.1, &resume)
  end

  def ping(name, &resume)
    engine.ping(@clients[name])
    resume.call
  end

  def clock_tick(time, &resume)
    EM.add_timer(time, &resume)
  end

  def expect_non_exclusive_event(name, event, args, engine, &resume)
    params  = [@clients[name]] + args
    handler = lambda { |*a| }

    # we don't care if the event is called for other clients
    filter = lambda do |*args|
      handler.call(*args) if args[0] == params[0]
    end

    engine.bind(event, &filter)
    handler.should_receive(:call).with(*params)
    resume.call
  end

  def expect_event(name, event, args, &resume)
    params  = [@clients[name]] + args
    handler = lambda { |*a| }
    engine.bind(event, &handler)
    handler.should_receive(:call).with(*params)
    resume.call
  end

  def expect_no_event(name, event, args, &resume)
    params  = [@clients[name]] + args
    handler = lambda { |*a| }
    engine.bind(event, &handler)
    handler.should_not_receive(:call).with(*params)
    resume.call
  end

  def expect_message(name, messages, &resume)
    @inboxes[name].should == messages
    resume.call
  end

  def expect_no_message(name, &resume)
    @inboxes[name].should == []
    resume.call
  end

  def check_different_messages(a, b, &resume)
    @inboxes[a].first.should_not be_equal(@inboxes[b].first)
    resume.call
  end
end

shared_examples_for "faye engine" do
  include EncodingHelper
  include EngineSteps

  def create_engine
    opts = options.merge(engine_opts)
    Faye::Engine::Proxy.new(opts)
  end

  let(:options) { {:timeout => 1} }
  let(:engine) { create_engine }

  before do
    Faye::Engine.ensure_reactor_running!
    create_client :alice
    create_client :bob
    create_client :carol
  end

  describe :create_client do
    it "returns a client id" do
      create_client :dave
      check_client_id :dave, /^[a-z0-9]+$/
    end

    it "returns a different id every time" do
      1.upto(7) { |i| create_client "client#{i}" }
      check_num_clients 10
    end

    it "publishes an event" do
      engine.should_receive(:trigger).with(:handshake, match(/^[a-z0-9]+$/)).exactly(4)
      create_client :dave
    end

    describe :gc do
      let(:options) { {:timeout => 0.3, :gc => 0.2} }

      it "doesn't prematurely remove a client after creation" do
        clock_tick 0.25
        check_client_exists :alice, true
      end
    end
  end

  describe :client_exists do
    it "returns true if the client id exists" do
      check_client_exists :alice, true
    end

    it "returns false if the client id does not exist" do
      check_client_exists :anything, false
    end
  end

  describe :ping do
    let(:options) { {:timeout => 0.3, :gc => 0.08} }

    it "removes a client if it does not ping often enough" do
      clock_tick 0.7
      check_client_exists :alice, false
    end

    it "prolongs the life of a client" do
      clock_tick 0.45
      ping :alice
      clock_tick 0.45
      check_client_exists :alice, true
      clock_tick 0.45
      check_client_exists :alice, false
    end
  end

  describe :destroy_client do
    it "removes the given client" do
      destroy_client :alice
      check_client_exists :alice, false
    end

    it "publishes an event" do
      expect_event :alice, :disconnect, []
      destroy_client :alice
    end

    describe "when the client has subscriptions" do
      before do
        @message = {"channel" => "/messages/foo", "data" => "ok"}
        subscribe :alice, "/messages/foo"
      end

      it "stops the client receiving messages" do
        connect :alice, engine
        destroy_client :alice
        publish @message
        expect_no_message :alice
      end

      it "publishes an event" do
        expect_event :alice, :disconnect, []
        destroy_client :alice
      end
    end
  end

  describe :subscribe do
    it "publishes an event" do
      expect_event :alice, :subscribe, ["/messages/foo"]
      subscribe :alice, "/messages/foo"
    end

    describe "when the client is subscribed to the channel" do
      before { subscribe :alice, "/messages/foo" }

      it "does not publish an event" do
        expect_no_event :alice, :subscribe, ["/messages/foo"]
        subscribe :alice, "/messages/foo"
      end
    end
  end

  describe :unsubscribe do
    before { subscribe :alice, "/messages/bar" }

    it "does not publish an event" do
      expect_no_event :alice, :unsubscribe, ["/messages/foo"]
      unsubscribe :alice, "/messages/foo"
    end

    describe "when the client is subscribed to the channel" do
      before { subscribe :alice, "/messages/foo" }

      it "publishes an event" do
        expect_event :alice, :unsubscribe, ["/messages/foo"]
        unsubscribe :alice, "/messages/foo"
      end
    end
  end

  describe :publish do
    before do
      @message = {"channel" => "/messages/foo", "data" => "ok", "blank" => nil}
      connect :alice, engine
      connect :bob,   engine
      connect :carol, engine
    end

    describe "with no subscriptions" do
      it "delivers no messages" do
        publish @message
        expect_no_message :alice
        expect_no_message :bob
        expect_no_message :carol
      end

      it "publishes a :publish event with a clientId" do
        expect_event :bob, :publish, ["/messages/foo", "ok"]
        publish_by :bob, @message
      end

      it "publishes a :publish event with no clientId" do
        expect_event nil, :publish, ["/messages/foo", "ok"]
        publish @message
      end
    end

    describe "with a subscriber" do
      before { subscribe :alice, "/messages/foo" }

      it "delivers messages to the subscribed client" do
        publish @message
        expect_message :alice, [@message]
      end

      it "delivers multibyte messages correctly" do
        @message["data"] = encode "Apple = "
        publish @message
        expect_message :alice, [@message]
      end

      it "publishes a :publish event" do
        expect_event :bob, :publish, ["/messages/foo", "ok"]
        publish_by :bob, @message
      end
    end

    describe "with a subscriber that is removed" do
      before do
        subscribe :alice, "/messages/foo"
        unsubscribe :alice, "/messages/foo"
      end

      it "does not deliver messages to unsubscribed clients" do
        publish @message
        expect_no_message :alice
        expect_no_message :bob
        expect_no_message :carol
      end

      it "publishes a :publish event" do
        expect_event :bob, :publish, ["/messages/foo", "ok"]
        publish_by :bob, @message
      end
    end

    describe "with multiple subscribers" do
      before do
        subscribe :alice, "/messages/foo"
        subscribe :bob,   "/messages/bar"
        subscribe :carol, "/messages/foo"
      end

      it "delivers messages to the subscribed clients" do
        publish @message
        expect_message    :alice, [@message]
        expect_no_message :bob
        expect_message    :carol, [@message]
      end
    end

    describe "with a single wildcard" do
      before do
        subscribe :alice, "/messages/*"
        subscribe :bob,   "/messages/bar"
        subscribe :carol, "/*"
      end

      it "delivers messages to matching subscriptions" do
        publish @message
        expect_message    :alice, [@message]
        expect_no_message :bob
        expect_no_message :carol
      end
    end

    describe "with a double wildcard" do
      before do
        subscribe :alice, "/messages/**"
        subscribe :bob,   "/messages/bar"
        subscribe :carol, "/**"
      end

      it "delivers messages to matching subscriptions" do
        publish @message
        expect_message    :alice, [@message]
        expect_no_message :bob
        expect_message    :carol, [@message]
      end

      it "delivers a unique copy of the message to each client" do
        publish @message
        check_different_messages :alice, :carol
      end
    end

    describe "with multiple matching subscriptions for the same client" do
      before do
        subscribe :alice, "/messages/foo"
        subscribe :alice, "/messages/*"
      end

      it "delivers each message once to each client" do
        publish @message
        expect_message :alice, [@message]
      end

      it "delivers the message as many times as it is published" do
        publish [@message, @message]
        expect_message :alice, [@message, @message]
      end
    end
  end
end

shared_examples_for "distributed engine" do
  include EngineSteps

  def create_engine
    opts = options.merge(engine_opts)
    Faye::Engine::Proxy.new(opts)
  end

  let(:options) { {} }
  let(:left)  { create_engine }
  let(:right) { create_engine }

  alias :engine :left

  before do
    Faye::Engine.ensure_reactor_running!
    create_client :alice
    create_client :bob

    connect :alice, left
  end

  describe :publish do
    before do
      subscribe :alice, "/foo"
      publish "channel" => "/foo", "data" => "first"
    end

    it "only delivers each message once" do
      expect_message :alice, ["channel" => "/foo", "data" => "first"]
      publish "channel" => "/foo", "data" => "second"
      connect :alice, right
      expect_message :alice, [{"channel" => "/foo", "data" => "first"}, {"channel" => "/foo", "data" => "second"}]
    end
  end

  describe :gc do
    let(:options) { {:timeout => 0.3, :gc => 0.08} }

    it "calls close in each engine when a client is removed" do
      expect_non_exclusive_event :alice, :close, [], left
      expect_non_exclusive_event :alice, :close, [], right

      clock_tick 0.7
    end
  end
end
