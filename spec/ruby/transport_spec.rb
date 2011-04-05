require "spec_helper"

describe Faye::Transport do
  let :client do
    client = mock("client")
    client.stub(:endpoint).and_return("http://example.com/")
    client
  end
  
  describe :get do
    before do
      Faye::Transport::Local.stub(:usable?).and_return(false)
      Faye::Transport::Http.stub(:usable?).and_return(false)
    end
    
    let(:transport)       { Faye::Transport.get(client, ["long-polling", "in-process"]) }
    let(:local_transport) { Faye::Transport.get(client, ["in-process"]) }
    let(:http_transport)  { Faye::Transport.get(client, ["long-polling"]) }
    
    describe "when no transport is usable" do
      it "raises an exception" do
        lambda { transport }.should raise_error
      end
    end
    
    describe "when a less preferred transport is usable" do
      before do
        Faye::Transport::Http.stub(:usable?).and_return(true)
      end
      
      it "returns a transport of the usable type" do
        transport.should be_kind_of(Faye::Transport::Http)
      end
      
      it "rasies an exception of the usable type is not requested" do
        lambda { local_transport }.should raise_error
      end
      
      it "allows the usable type to be specifically selected" do
        http_transport.should be_kind_of(Faye::Transport::Http)
      end
    end
    
    describe "when all transports are usable" do
      before do
        Faye::Transport::Local.stub(:usable?).and_return(true)
        Faye::Transport::Http.stub(:usable?).and_return(true)
      end
      
      it "returns the most preferred type" do
        transport.should be_kind_of(Faye::Transport::Local)
      end
      
      it "allows types to be specifically selected" do
        local_transport.should be_kind_of(Faye::Transport::Local)
        http_transport.should be_kind_of(Faye::Transport::Http)
      end
    end
  end
end
