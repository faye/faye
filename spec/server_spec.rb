require 'spec_helper'

describe Faye::Server do
  before do
    stub_engine = engine
    Faye::Engine::Memory.stub(:new).and_return(stub_engine)
  end
  
  let(:engine) { Faye::Engine::Memory.new }
  let(:server) { Faye::Server.new }
  
  let(:client_id) do
    message = {'channel' => '/meta/handshake',
               'version' => '1.0',
               'supportedConnectionTypes' => ['long-polling']}
    
    client_id = nil
    server.__send__(:handshake, message) { |r| client_id = r['clientId'] }
    client_id
  end
  
  def method_missing(action, local = false)
    message['channel'] = "/meta/#{action}"
    return @response if defined?(@response)
    server.__send__(action, message, local) { |r| @response = r }
    @response
  end
  
  describe :handshake do
    before do
      engine.stub(:create_client_id).and_callback('the_id')
    end
    
    describe "with valid parameters" do
      let(:message) { {'version' => '1.0',
                        'supportedConnectionTypes' => ['long-polling']}
                    }
      
      it "gets a clientId from the engine" do
        engine.should_receive(:create_client_id).once
        handshake
      end
      
      it "returns a successful response containing a clientId" do
        handshake.should == {
          'channel'    => '/meta/handshake',
          'version'    => '1.0',
          'supportedConnectionTypes' => ['long-polling', 'callback-polling', 'websocket'],
          'clientId'   => 'the_id',
          'successful' => true
        }
      end
      
      describe "with a message id" do
        before { message['id'] = 'foo' }
        
        it "returns the same id" do
          handshake.should == {
            'channel'    => '/meta/handshake',
            'id'         => 'foo',
            'version'    => '1.0',
            'supportedConnectionTypes' => ['long-polling', 'callback-polling', 'websocket'],
            'clientId'   => 'the_id',
            'successful' => true
          }
        end
      end
    end
    
    describe "missing version" do
      let(:message) { {'supportedConnectionTypes' => ['long-polling']} }
      
      it "does not request a clientId" do
        engine.should_not_receive(:create_client_id)
        handshake
      end
      
      it "returns an unsuccessful response" do
        handshake.should == {
          'channel'     => '/meta/handshake',
          'successful'  => false,
          'error'       => '402:version:Missing required parameter',
          'version'     => '1.0',
          'supportedConnectionTypes' => ['long-polling', 'callback-polling', 'websocket']
        }
      end
    end
    
    describe "missing supportedConnectionTypes" do
      let(:message) { {'version' => '1.0'} }
      
      it "does not request a clientId" do
        engine.should_not_receive(:create_client_id)
        handshake
      end
      
      it "returns an unsuccessful response" do
        handshake.should == {
          'channel'     => '/meta/handshake',
          'successful'  => false,
          'error'       => '402:supportedConnectionTypes:Missing required parameter',
          'version'     => '1.0',
          'supportedConnectionTypes' => ['long-polling', 'callback-polling', 'websocket']
        }
      end
      
      it "returns a successful response for local clients" do
        handshake(true)['successful'].should == true
      end
    end
    
    describe "with no matching connection types" do
      let(:message) { {'version' => '1.0',
                       'supportedConnectionTypes' => ['iframe', 'flash']}
                    }
      
      it "does not request a clientId" do
        engine.should_not_receive(:create_client_id)
        handshake
      end
      
      it "returns an unsuccessful response" do
        handshake.should == {
          'channel'     => '/meta/handshake',
          'successful'  => false,
          'error'       => '301:iframe,flash:Connection types not supported',
          'version'     => '1.0',
          'supportedConnectionTypes' => ['long-polling', 'callback-polling', 'websocket']
        }
      end
    end
  end
  
  describe :connect do
    describe "with valid parameters" do
      let(:message) { {'clientId' => client_id, 'connectionType' => 'long-polling'} }
      
      before { engine.should_receive(:client_exists?).with(client_id).and_callback(true) }
      
      it "pings the engine to say the client is active" do
        engine.should_receive(:ping).with(client_id)
        connect
      end
      
      it "returns a successful response" do
        connect.should == {
          'channel'    => '/meta/connect',
          'successful' => true,
          'clientId'   => client_id
        }
      end
      
      describe "with a message id" do
        before { message['id'] = 'foo' }
        
        it "returns the same id" do
          connect.should == {
            'channel'    => '/meta/connect',
            'successful' => true,
            'clientId'   => client_id,
            'id'         => 'foo'
          }
        end
      end
    end
    
    describe "missing clientId" do
      let(:message) { {'connectionType' => 'long-polling'} }
      
      it "does not ping the engine" do
        engine.should_not_receive(:ping)
        connect
      end
      
      it "returns an unsuccessful response" do
        connect.should == {
          'channel'    => '/meta/connect',
          'successful' => false,
          'error'      => '402:clientId:Missing required parameter'
        }
      end
    end
    
    describe "with an unrecognized clientId" do
      let(:message) { {'clientId' => 'anything', 'connectionType' => 'long-polling'} }
      
      before { engine.should_receive(:client_exists?).with('anything').and_callback(false) }
      
      it "does not ping the engine" do
        engine.should_not_receive(:ping)
        connect
      end
      
      it "returns an unsuccessful response" do
        connect.should == {
          'channel'    => '/meta/connect',
          'successful' => false,
          'error'      => '401:anything:Unknown client'
        }
      end
    end
    
    describe "missing connectionType" do
      let(:message) { {'clientId' => client_id} }
      
      before { engine.should_receive(:client_exists?).with(client_id).and_callback(true) }
      
      it "does not ping the engine" do
        engine.should_not_receive(:ping)
        connect
      end
      
      it "returns an unsuccessful response" do
        connect.should == {
          'channel'    => '/meta/connect',
          'successful' => false,
          'error'      => '402:connectionType:Missing required parameter'
        }
      end
    end
    
    # TODO fail if the connectionType is not recognized
  end
  
  describe :disconnect do
    describe "with a clientId" do
      let(:message) { {'clientId' => client_id} }
      
      before { engine.should_receive(:client_exists?).with(client_id).and_callback(true) }
      
      it "tells the engine to disconnect the client" do
        engine.should_receive(:disconnect).with(client_id)
        disconnect
      end
      
      it "returns a successful response" do
        disconnect.should == {
          'channel'    => '/meta/disconnect',
          'successful' => true,
          'clientId'   => client_id
        }
      end
    end
    
    describe "with a clientId and an id" do
      let(:message) { {'clientId' => client_id, 'id' => 'foo'} }
      
      it "returns a successful response" do
        disconnect.should == {
          'channel'    => '/meta/disconnect',
          'successful' => true,
          'clientId'   => client_id,
          'id'         => 'foo'
        }
      end
    end
    
    describe "missing clientId" do
      let(:message) { {} }
      
      it "does not tell the engine to disconnect" do
        engine.should_not_receive(:disconnect)
        disconnect
      end
      
      it "returns an unsuccessful response" do
        disconnect.should == {
          'channel'    => '/meta/disconnect',
          'successful' => false,
          'error'      => '402:clientId:Missing required parameter'
        }
      end
    end
    
    describe "with an unrecognized clientId" do
      let(:message) { {'clientId' => 'anything'} }
      
      before { engine.should_receive(:client_exists?).with('anything').and_callback(false) }
      
      it "does not tell the engine to disconnect" do
        engine.should_not_receive(:disconnect)
        disconnect
      end
      
      it "returns an unsuccessful response" do
        disconnect.should == {
          'channel'    => '/meta/disconnect',
          'successful' => false,
          'error'      => '401:anything:Unknown client'
        }
      end
    end
  end
  
  describe :subscribe do
    describe "with a single subscription" do
      let(:message) { {'clientId' => client_id, 'subscription' => '/foo'} }
      
      before { engine.should_receive(:client_exists?).with(client_id).and_callback(true) }
      
      it "registers the subscription with the engine" do
        engine.should_receive(:subscribe).with(client_id, '/foo')
        subscribe
      end
      
      it "returns a successful response with a list of subscriptions" do
        subscribe.should == {
          'channel'      => '/meta/subscribe',
          'successful'   => true,
          'subscription' => ['/foo'],
          'clientId'     => client_id
        }
      end
    end
    
    describe "with a list of subscriptions" do
      let(:message) { {'clientId' => client_id, 'subscription' => ['/foo', '/bar']} }
      
      before { engine.should_receive(:client_exists?).with(client_id).and_callback(true) }
      
      it "registers the subscription with the engine" do
        engine.should_receive(:subscribe).with(client_id, '/foo')
        engine.should_receive(:subscribe).with(client_id, '/bar')
        subscribe
      end
      
      it "returns a successful response with a list of subscriptions" do
        subscribe.should == {
          'channel'      => '/meta/subscribe',
          'successful'   => true,
          'subscription' => ['/foo', '/bar'],
          'clientId'     => client_id
        }
      end
    end
    
    describe "with a single subscription pattern" do
      let(:message) { {'clientId' => client_id, 'subscription' => '/foo/**'} }
      
      before { engine.should_receive(:client_exists?).with(client_id).and_callback(true) }
      
      it "registers the subscription with the engine" do
        engine.should_receive(:subscribe).with(client_id, '/foo/**')
        subscribe
      end
      
      it "returns a successful response with a list of subscriptions" do
        subscribe.should == {
          'channel'      => '/meta/subscribe',
          'successful'   => true,
          'subscription' => ['/foo/**'],
          'clientId'     => client_id
        }
      end
    end
    
    describe "missing clientId" do
      let(:message) { {'subscription' => '/foo'} }
      
      it "does not register the subscription with the engine" do
        engine.should_not_receive(:subscribe)
        subscribe
      end
      
      it "returns an unsuccessful response" do
        subscribe.should == {
          'channel'      => '/meta/subscribe',
          'successful'   => false,
          'error'        => '402:clientId:Missing required parameter',
          'subscription' => ['/foo']
        }
      end
    end
    
    describe "with an unrecognized clientId" do
      let(:message) { {'clientId' => 'anything', 'subscription' => '/foo'} }
      
      before { engine.should_receive(:client_exists?).with('anything').and_callback(false) }
      
      it "does not register the subscription with the engine" do
        engine.should_not_receive(:subscribe)
        subscribe
      end
      
      it "returns an unsuccessful response" do
        subscribe.should == {
          'channel'      => '/meta/subscribe',
          'successful'   => false,
          'error'        => '401:anything:Unknown client',
          'subscription' => ['/foo'],
          'clientId'     => 'anything'
        }
      end
    end
    
    describe "missing subscription" do
      let(:message) { {'clientId' => client_id} }
      
      before { engine.should_receive(:client_exists?).with(client_id).and_callback(true) }
      
      it "does not register the subscription with the engine" do
        engine.should_not_receive(:subscribe)
        subscribe
      end
      
      it "returns an unsuccessful response" do
        subscribe.should == {
          'channel'      => '/meta/subscribe',
          'successful'   => false,
          'error'        => '402:subscription:Missing required parameter',
          'subscription' => [],
          'clientId'     => client_id
        }
      end
    end
    
    describe "with an invalid channel" do
      let(:message) { {'clientId' => client_id, 'subscription' => '/not/**/valid'} }
      
      it "does not register the subscription with the engine" do
        engine.should_not_receive(:subscribe)
        subscribe
      end
      
      it "returns an unsuccessful response" do
        subscribe.should == {
          'channel'      => '/meta/subscribe',
          'successful'   => false,
          'error'        => '405:/not/**/valid:Invalid channel',
          'subscription' => ['/not/**/valid'],
          'clientId'     => client_id
        }
      end
    end
    
    describe "with a meta channel" do
      let(:message) { {'clientId' => client_id, 'subscription' => '/meta/foo'} }
      
      it "does not register the subscription with the engine" do
        engine.should_not_receive(:subscribe)
        subscribe
      end
      
      it "returns an unsuccessful response" do
        subscribe.should == {
          'channel'      => '/meta/subscribe',
          'successful'   => false,
          'error'        => '403:/meta/foo:Forbidden channel',
          'subscription' => ['/meta/foo'],
          'clientId'     => client_id
        }
      end
      
      it "registers the subscription for local clients" do
        engine.should_receive(:subscribe).with(client_id, '/meta/foo')
        subscribe(true)
      end
      
      it "returns a successful response for local clients" do
        subscribe(true).should == {
          'channel'      => '/meta/subscribe',
          'successful'   => true,
          'subscription' => ['/meta/foo'],
          'clientId'     => client_id
        }
      end
    end
    
    describe "with a service channel" do
      let(:message) { {'clientId' => client_id, 'subscription' => '/service/foo'} }
      
      it "does not register the subscription with the engine" do
        engine.should_not_receive(:subscribe)
        subscribe
      end
      
      it "returns an unsuccessful response" do
        subscribe.should == {
          'channel'      => '/meta/subscribe',
          'successful'   => false,
          'error'        => '403:/service/foo:Forbidden channel',
          'subscription' => ['/service/foo'],
          'clientId'     => client_id
        }
      end
    end
      
    describe "with an extension that adds errors" do
      let(:message) { {'channel' => '/meta/subscribe', 'clientId' => client_id, 'subscription' => '/foo'} }
      
      before do
        extension = Object.new
        def extension.incoming(message, callback)
          message['error'] = Faye::Error.parameter_missing('foo')
          callback.call(message)
        end
        server.add_extension(extension)
      end
      
      it "does not register the subscription with the engine" do
        engine.should_not_receive(:subscribe)
        server.__send__(:process, message) {}
      end
      
      it "passes the error and subscription back to the client" do
        server.__send__(:process, message) do |response|
          response.first.should == {
            'channel'      => '/meta/subscribe',
            'successful'   => false,
            'error'        => '402:foo:Missing required parameter',
            'subscription' => ['/foo'],
            'clientId'     => client_id,
            'advice'       => { 'reconnect'  => 'retry', 'interval'   => 0, 'timeout'    => 60000 }
          }
        end
      end
    end
  end
  
  describe :unsubscribe do
    before do
      server.__send__(:subscribe, 'channel'      => '/meta/subscribe',
                                  'subscription' => '/my/channel',
                                  'clientId'     => client_id) {}
    end
    
    describe "with a channel the client is subscribed to" do
      let(:message) { {'clientId' => client_id, 'subscription' => '/my/channel'} }
      
      before { engine.should_receive(:client_exists?).with(client_id).and_callback(true) }
      
      it "removes the subscription from the engine" do
        engine.should_receive(:unsubscribe).with(client_id, '/my/channel')
        unsubscribe
      end
      
      it "returns a successful response" do
        unsubscribe.should == {
          'channel'      => '/meta/unsubscribe',
          'subscription' => ['/my/channel'],
          'successful'   => true,
          'clientId'     => client_id
        }
      end
    end
    
    describe "missing clientId" do
      let(:message) { {'subscription' => '/my/channel'} }
      
      it "does not remove the subscription from the engine" do
        engine.should_not_receive(:unsubscribe)
        unsubscribe
      end
      
      it "returns an unsuccessful response" do
        unsubscribe.should == {
          'channel'      => '/meta/unsubscribe',
          'subscription' => ['/my/channel'],
          'successful'   => false,
          'error'        => '402:clientId:Missing required parameter'
        }
      end
    end
    
    describe "with an unrecognized clientId" do
      let(:message) { {'clientId' => 'anything', 'subscription' => '/my/channel'} }
      
      before { engine.should_receive(:client_exists?).with('anything').and_callback(false) }
      
      it "does not remove the subscription from the engine" do
        engine.should_not_receive(:unsubscribe)
        unsubscribe
      end
      
      it "returns a successful response" do
        unsubscribe.should == {
          'channel'      => '/meta/unsubscribe',
          'subscription' => ['/my/channel'],
          'successful'   => false,
          'error'        => '401:anything:Unknown client',
          'clientId'     => 'anything'
        }
      end
    end
    
    describe "missing subscription" do
      let(:message) { {'clientId' => client_id} }
      
      before { engine.should_receive(:client_exists?).with(client_id).and_callback(true) }
      
      it "does not remove the subscription from the engine" do
        engine.should_not_receive(:unsubscribe)
        unsubscribe
      end
      
      it "returns an unsuccessful response" do
        unsubscribe.should == {
          'channel'      => '/meta/unsubscribe',
          'successful'   => false,
          'error'        => '402:subscription:Missing required parameter',
          'subscription' => [],
          'clientId'     => client_id
        }
      end
    end
    
    describe "with an invalid channel" do
      let(:message) { {'clientId' => client_id, 'subscription' => '/not/**/valid'} }
      
      it "does not remove the subscription from the engine" do
        engine.should_not_receive(:unsubscribe)
        unsubscribe
      end
      
      it "returns an unsuccessful response" do
        unsubscribe.should == {
          'channel'      => '/meta/unsubscribe',
          'successful'   => false,
          'error'        => '405:/not/**/valid:Invalid channel',
          'subscription' => ['/not/**/valid'],
          'clientId'     => client_id
        }
      end
    end
    
    describe "with a meta channel" do
      let(:message) { {'clientId' => client_id, 'subscription' => '/meta/foo'} }
      
      it "removes the subscription from the engine for local clients" do
        engine.should_receive(:unsubscribe).with(client_id, '/meta/foo')
        unsubscribe(true)
      end
      
      it "returns a successful response for local clients" do
        unsubscribe(true).should == {
          'channel'      => '/meta/unsubscribe',
          'successful'   => true,
          'subscription' => ['/meta/foo'],
          'clientId'     => client_id
        }
      end
    end
    
    # TODO specify behaviour for meta and service channels
    # currently they return successful responses
  end
  
  describe :advice do
    it "tells the client to retry if a valid request is made" do
      message = {'channel' => '/meta/subscribe', 'clientId' => client_id, 'subscription' => '/foo'}
      server.__send__(:handle, message) do |response|
        response.first['advice'].should == {
          'reconnect' => 'retry',
          'interval'  => 0,
          'timeout'   => 60000
        }
      end
    end
    
    it "tells the client to handshake if an invalid request is made" do
      message = {'channel' => '/meta/subscribe', 'clientId' => 'anything', 'subscription' => '/foo'}
      server.__send__(:handle, message) do |response|
        response.first['advice'].should == { 'reconnect' => 'handshake' }
      end
    end
  end
end

