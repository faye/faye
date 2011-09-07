# encoding=utf-8

require "spec_helper"

EngineSteps = EM::RSpec.async_steps do
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
    EM.add_timer(0.01, &resume)
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
      message = {"id" => Faye.random}.merge(message)
      engine.publish(message)
    end
    EM.add_timer(0.01, &resume)
  end
  
  def ping(name, &resume)
    engine.ping(@clients[name])
    resume.call
  end
  
  def clock_tick(time, &resume)
    clock.tick(time)
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
  
  def clean_redis_db(&resume)
    engine.disconnect
    redis = EM::Hiredis::Client.connect
    redis.flushall(&resume)
  end

  def set_callback(type,method,&resume)
    engine.set_callback(type,method) do |*args, &_resume|
      @callbacks ||= {}
      @callbacks[type] ||= {}
      @callbacks[type][method] = args
      _resume.call(*args)
    end
    resume.call
  end

  def expect_callback(type,method,&resume)
    @callbacks ||= {}
    @callbacks[type] ||= {}
    @callbacks[type][method].should_not == nil
    resume.call
  end
  
  # Don't do anything, just call client_exists on the engine
  def client_exists(name, &resume)
    engine.client_exists(@clients[name]) { |noop|
      resume.call
    }
  end

end

describe "Pub/sub engines" do
  def create_engine
    engine_klass.new(options.merge(engine_opts))
  end
  
  shared_examples_for "faye engine" do
    include EncodingHelper
    include EngineSteps
    
    let(:options) { {:timeout => 1} }
    let(:engine) { create_engine }
    
    before do
      Faye.ensure_reactor_running!
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
    end
    
    describe :client_exists do
      it "returns true if the client id exists" do
        check_client_exists :alice, true
      end
      
      it "returns false if the client id does not exist" do
        check_client_exists :anything, false
      end
    end
=begin
    describe :ping do
      it "removes a client if it does not ping often enough" do
        clock_tick 2
        check_client_exists :alice, false
      end
      
      it "prolongs the life of a client" do
        clock_tick 1
        ping :alice
        clock_tick 1
        check_client_exists :alice, true
        clock_tick 1
        check_client_exists :alice, false
      end
    end
=end
    describe :destroy_client do
      it "removes the given client" do
        destroy_client :alice
        check_client_exists :alice, false
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
      end
    end
    
    describe :publish do
      before do
        @message = {"channel" => "/messages/foo", "data" => "ok"}
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

  shared_examples_for "engine with callbacks" do
    include EngineSteps

    before do
      Faye.ensure_reactor_running!
    end

    describe "callbacks mixin" do
      let(:options) { {} }
      let(:engine)  { create_engine }

      before do
        set_callback(:after, :create_client)
      end
      
      it "defines the set_callback method" do
        engine.should.respond_to? :set_callback
      end

      it "aliases the original method" do
        engine.should.respond_to? :create_client_without_callback_hooks
      end

      it "defines the new hooked method" do
        engine.should.respond_to? :create_client_with_callback_hooks
      end

      it "aliases the new hooked method" do
        engine.method(:create_client).should == engine.method(:create_client_with_callback_hooks)
      end
    end

    describe "callbacks run" do
      let(:options) { {} }
      let(:engine)  { create_engine }


      describe :create_client do
        before do
          set_callback(:after, :create_client)
          create_client :alice
        end
        it :after do
          expect_callback(:after, :create_client)
        end
      end

      describe :client_exists do
        before do
          set_callback(:before, :client_exists)
          set_callback(:after, :client_exists)
          create_client :alice
          client_exists :alice
        end
        it :before do
          expect_callback(:before, :client_exists)
        end
        it :after do
          expect_callback(:after, :client_exists)
        end
      end

      describe :subscribe do
        before do
          set_callback(:before, :subscribe)
          set_callback(:after, :subscribe)
          create_client :alice
          subscribe :alice, '/messages/foo'
        end
        it :before do
          expect_callback(:before, :subscribe)
        end
        it :after do
          expect_callback(:after, :subscribe)
        end
      end

      describe :publish do
        before do
          @message = {"channel" => "/messages/foo", "data" => "ok"}
          set_callback(:before, :publish)
          publish @message
        end
        it :before do
          expect_callback(:before, :publish)
        end
      end

      describe :unsubscribe do
        before do
          set_callback(:before, :unsubscribe)
          set_callback(:after, :unsubscribe)
          create_client :alice
          subscribe :alice, '/messages/foo'
          unsubscribe :alice, '/messages/foo'
        end
        it :before do
          expect_callback(:before, :unsubscribe)
        end
        it :after do
          expect_callback(:after, :unsubscribe)
        end
      end

      describe :destroy_client do
        before do
          set_callback(:before, :destroy_client)
          set_callback(:after, :destroy_client)
          create_client :alice
          destroy_client :alice
        end
        it :before do
          expect_callback(:before, :destroy_client)
        end
        it :after do
          expect_callback(:after, :destroy_client)
        end
      end
    end
  end
  
  shared_examples_for "distributed engine" do
    include EngineSteps
    
    let(:options) { {} }
    let(:left)  { create_engine }
    let(:right) { create_engine }
    
    alias :engine :left
    
    before do
      Faye.ensure_reactor_running!
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
  end
  
  describe Faye::Engine::Memory do
    let(:engine_klass) { Faye::Engine::Memory }
    let(:engine_opts)  { {} }
    #it_should_behave_like "faye engine"
    it_should_behave_like "engine with callbacks"
  end
  
  describe Faye::Engine::Redis do
    let(:engine_klass) { Faye::Engine::Redis }
    let(:engine_opts)  { {:password => "foobared", :namespace => Time.now.to_i.to_s} }
    after { clean_redis_db }
    it_should_behave_like "faye engine"
    it_should_behave_like "distributed engine"
  end

end

