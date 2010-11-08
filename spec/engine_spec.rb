unless $engine_spec
  $engine_spec = true

  shared_examples_for "faye engine" do
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
      let(:client_id) do
        client_id = nil
        engine.create_client_id { |id| client_id = id }
        client_id
      end
      
      it "returns true if the client id exists" do
        engine.client_exists?(client_id) { |e| e.should be_true }
      end
      
      it "returns false if the client id does not exist" do
        engine.client_exists?('anything') { |e| e.should be_false }
      end
    end
  end

end

