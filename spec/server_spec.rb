require 'spec_helper'

describe Faye::Server do
  let(:server) { Faye::Server.new }
  
  let(:client_id) do
    message = {'channel' => '/meta/handshake',
               'version' => '1.0',
               'supportedConnectionTypes' => ['long-polling']}
    
    server.__send__(:handshake, message)['clientId']
  end
  
  def method_missing(action, local = false)
    message['channel'] = "/meta/#{action}"
    @response ||= server.__send__(action, message, local)
  end
  
  describe :handshake do
    describe "with valid parameters" do
      let(:message) { {'version' => '1.0',
                        'supportedConnectionTypes' => ['long-polling']}
                    }
      
      it "returns the channel name" do
        handshake['channel'].should == '/meta/handshake'
      end
      
      it "returns a version" do
        handshake['version'].should == '1.0'
      end
      
      it "returns the server's supported connection types" do
        handshake['supportedConnectionTypes'].should == ['long-polling', 'callback-polling', 'websocket']
      end
      
      it "returns a clientId" do
        handshake['clientId'].should =~ /^[a-z0-9]+$/
      end
      
      it "is successful" do
        handshake['successful'].should be_true
      end
      
      it "returns the id from the message" do
        handshake.should_not include('id')
      end
      
      describe "with a message id" do
        before { message['id'] = 'foo' }
        
        it "returns the same id" do
          handshake['id'].should == 'foo'
        end
      end
    end
    
    describe "missing version" do
      let(:message) { {'supportedConnectionTypes' => ['long-polling']} }
      
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
      
      it "returns an unsuccessful response" do
        subscribe.should == {
          'channel'      => '/meta/subscribe',
          'successful'   => false,
          'error'        => '403:/meta/foo:Forbidden channel',
          'subscription' => ['/meta/foo'],
          'clientId'     => client_id
        }
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
      before do
        extension = Object.new
        def extension.incoming(message, callback)
          message['error'] = Faye::Error.parameter_missing('foo')
          callback.call(message)
        end
        server.add_extension(extension)
      end
      
      it "passes the error and subscription back to the client" do
        message = {'channel' => '/meta/subscribe', 'clientId' => client_id, 'subscription' => '/foo'}
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
                                  'clientId'     => client_id)
    end
    
    describe "with a channel the client is subscribed to" do
      let(:message) { {'clientId' => client_id, 'subscription' => '/my/channel'} }
      
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

