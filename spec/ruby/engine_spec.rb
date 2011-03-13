require "spec_helper"

EngineSteps = EM::RSpec.async_steps do
  def create_client(name, &resume)
    @clients ||= {}
    engine.create_client do |client_id|
      @clients[name] = client_id
      resume.call
    end
  end
  
  def destroy_client(name, &resume)
    engine.destroy_client(@clients[name])
    resume.call
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
  
  def publish(message, &resume)
    engine.publish(message)
    resume.call
  end
  
  def ping(name, &resume)
    engine.ping(@clients[name])
    resume.call
  end
  
  def clock_tick(time, &resume)
    clock.tick(time)
    resume.call
  end
  
  def expect_announce(name, message, &resume)
    engine.should_receive(:announce).with(@clients[name], message)
    resume.call
  end
  
  def expect_no_announce(name, message, &resume)
    engine.should_not_receive(:announce).with(@clients[name], message)
    resume.call
  end
end

describe "Pub/sub engines" do
  shared_examples_for "faye engine" do
    include EM::RSpec::FakeClock
    include EngineSteps
    
    let(:options) { {} }
    
    before do
      Faye.ensure_reactor_running!
      clock.stub
      create_client :alice
      create_client :bob
      create_client :carol
    end
    
    after do
      clock.reset
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
    
    describe :ping do
      let(:options) { {:timeout => 1} }
      
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
          engine.should_not_receive(:announce)
          destroy_client :alice
          publish @message
        end
      end
    end
    
    describe :publish do
      before do
        @message = {"channel" => "/messages/foo", "data" => "ok"}
      end
      
      describe "with no subscriptions" do
        it "delivers no messages" do
          engine.should_not_receive(:announce)
          engine.publish(@message)
        end
      end
      
      describe "with a subscriber" do
        before { subscribe :alice, "/messages/foo" }
        
        it "delivers messages to the subscribed client" do
          expect_announce :alice, @message
          publish @message
        end
      end
      
      describe "with a subscriber that is removed" do
        before do
          subscribe :alice, "/messages/foo"
          unsubscribe :alice, "/messages/foo"
        end
        
        it "does not deliver messages to unsubscribed clients" do
          engine.should_not_receive(:announce)
          engine.publish(@message)
        end
      end
      
      describe "with multiple subscribers" do
        before do
          subscribe :alice, "/messages/foo"
          subscribe :bob,   "/messages/bar"
          subscribe :carol, "/messages/foo"
        end
        
        it "delivers messages to the subscribed clients" do
          expect_announce    :alice, @message
          expect_no_announce :bob,   @message
          expect_announce    :carol, @message
          
          publish @message
        end
      end
      
      describe "with a single wildcard" do
        before do
          subscribe :alice, "/messages/*"
          subscribe :bob,   "/messages/bar"
          subscribe :carol, "/*"
        end
        
        it "delivers messages to the subscribed clients" do
          expect_announce    :alice, @message
          expect_no_announce :bob,   @message
          expect_no_announce :carol, @message
          
          publish @message
        end
      end
      
      describe "with a double wildcard" do
        before do
          subscribe :alice, "/messages/**"
          subscribe :bob,   "/messages/bar"
          subscribe :carol, "/**"
        end
        
        it "delivers messages to the subscribed clients" do
          expect_announce    :alice, @message
          expect_no_announce :bob,   @message
          expect_announce    :carol, @message
          
          publish @message
        end
      end
    end
  end
  
  describe Faye::Engine::Memory do
    let(:engine) { Faye::Engine::Memory.new(options) }
    it_should_behave_like "faye engine"
  end
end

