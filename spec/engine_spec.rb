unless $engine_spec
  $engine_spec = true

  shared_examples_for "faye engine" do
    def make_client_id
      client_id = nil
      engine.create_client_id { |id| client_id = id }
      client_id
    end
    
    let(:alice) { make_client_id }
    let(:bob)   { make_client_id }
    let(:cecil) { make_client_id }
    
    let(:options) { {:timeout => 60} }
    
    describe :create_client_id do
      it "returns a client id" do
        engine.create_client_id { |id| id.should =~ /^[a-z0-9]+$/ }
      end
      
      it "returns a different id every time" do
        ids = Set.new
        (1..10).each { engine.create_client_id(&ids.method(:add)) }
        ids.size.should == 10
      end
    end
    
    describe :client_exists? do
      it "returns true if the client id exists" do
        engine.client_exists?(alice) { |e| e.should be_true }
      end
      
      it "returns false if the client id does not exist" do
        engine.client_exists?('anything') { |e| e.should be_false }
      end
    end
    
    describe :ping do
      before { options[:timeout] = 1 }
      
      it "removes a client if it does not ping often enough" do
        engine.client_exists?(alice) { |e| e.should be_true }
        sleep 2.5
        engine.client_exists?(alice) { |e| e.should be_false }
      end
      
      it "removes a client if it does not ping often enough" do
        engine.client_exists?(alice) { |e| e.should be_true }
        sleep 1.5
        engine.ping(alice)
        sleep 1.0
        engine.client_exists?(alice) { |e| e.should be_true }
      end
    end
    
    describe :disconnect do
      it "removes the given client" do
        engine.disconnect(alice)
        engine.client_exists?(alice) { |e| e.should be_false }
      end
      
      describe "when the client has subscriptions" do
        let(:inbox) { Hash.new { |h,k| h[k] = [] } }
        let(:message) { {'channel' => '/messages/foo',    'data' => 'ok'} }
        
        before do
          engine.on_message do |client_id, message|
            inbox[client_id] << message
          end
          engine.subscribe(alice, '/messages/foo')
        end
        
        it "stops the client receiving messages" do
          engine.disconnect(alice)
          engine.distribute(message)
          inbox.should == {}
        end
      end
    end
    
    describe :distribute do
      let(:inbox) { Hash.new { |h,k| h[k] = [] } }
      let(:message) { {'channel' => '/messages/foo',    'data' => 'ok'} }
      
      before do
        engine.on_message do |client_id, message|
          inbox[client_id] << message
        end
      end
      
      describe "with no subscriptions" do
        it "delivers no messages" do
          engine.distribute(message)
          inbox.should == {}
        end
      end
      
      describe "with a subscriber" do
        before do
          engine.subscribe(alice, '/messages/foo')
        end
        
        it "delivers messages to the subscribed client" do
          engine.distribute(message)
          inbox.should == { alice => [message] }
        end
      end
      
      describe "with a subscriber that is removed" do
        before do
          engine.subscribe(alice, '/messages/foo')
          engine.unsubscribe(alice, '/messages/foo')
        end
        
        it "does not deliver messages to unsubscribed clients" do
          engine.distribute(message)
          inbox.should == {}
        end
      end
      
      describe "with multiple subscribers" do
        before do
          engine.subscribe(alice, '/messages/foo')
          engine.subscribe(bob,   '/messages/bar')
          engine.subscribe(cecil, '/messages/foo')
        end
        
        it "delivers messages to the subscribed clients" do
          engine.distribute(message)
          inbox.should == {
            alice => [message],
            cecil => [message]
          }
        end
      end
      
      describe "with a single wildcard" do
        before do
          engine.subscribe(alice, '/messages/*')
          engine.subscribe(bob,   '/messages/bar')
          engine.subscribe(cecil, '/*')
        end
        
        it "delivers messages to matching subscriptions" do
          engine.distribute(message)
          inbox.should == { alice => [message] }
        end
      end
      
      describe "with a double wildcard" do
        before do
          engine.subscribe(alice, '/messages/**')
          engine.subscribe(bob,   '/messages/bar')
          engine.subscribe(cecil, '/**')
        end
        
        it "delivers messages to matching subscriptions" do
          engine.distribute(message)
          inbox.should == {
            alice => [message],
            cecil => [message]
          }
        end
      end
    end
  end

end

