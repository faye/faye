require "spec_helper"

describe Faye::Client do
  let :dispatcher do
    dispatcher = double(:dispatcher,
                        :connection_type  => "fake-transport",
                        :connection_types => ["fake-transport", "another-transport"],
                        :retry            => 5,
                        :select_transport => nil,
                        :send_message     => nil)

    class << dispatcher
      attr_accessor :client_id, :timeout
      include Faye::Publisher
    end

    Faye::Publisher.instance_method(:initialize).bind(dispatcher).call
    dispatcher.client_id = "fakeid"
    dispatcher
  end

  before do
    Faye::Dispatcher.stub(:new).and_return(dispatcher)
    EM.stub(:add_timer)
  end

  def stub_response(response)
    dispatcher.stub(:send_message) do |message|
      response["id"] = message["id"]
      @client.__send__(:receive_message, response)
    end
  end

  def create_client
    @client = Faye::Client.new("http://localhost/")
  end

  def create_connected_client
    create_client
    stub_response "channel"    => "/meta/handshake",
                  "successful" => true,
                  "version"    => "1.0",
                  "supportedConnectionTypes" => ["websocket"],
                  "clientId"   => "fakeid"

    @client.handshake
  end

  def subscribe(client, channel, callback = nil)
    stub_response "channel"      => "/meta/subscribe",
                  "successful"   => true,
                  "clientId"     => "fakeid",
                  "subscription" => channel

    @subs_called = 0
    callback ||= lambda { |m| @subs_called = 1 }
    @client.subscribe(channel, &callback)
  end

  describe :initialize do
    it "puts the client in the UNCONNECTED state" do
      client = Faye::Client.new("http://localhost/")
      client.instance_eval { @state }.should == Faye::Client::UNCONNECTED
    end
  end

  describe :handshake do
    before { create_client }

    it "creates a transport the server must support" do
      dispatcher.should_receive(:select_transport).with(["long-polling", "callback-polling", "in-process"])
      @client.handshake
    end

    it "sends a handshake message to the server" do
      dispatcher.should_receive(:send_message).with({
        "channel" => "/meta/handshake",
        "version" => "1.0",
        "supportedConnectionTypes" => ["fake-transport", "another-transport"],
        "id"      => instance_of(String)
      }, 72, {})
      @client.handshake
    end

    it "puts the client in the CONNECTING state" do
      @client.handshake
      @client.instance_eval { @state }.should == Faye::Client::CONNECTING
    end

    describe "with an outgoing extension installed" do
      before do
        extension = Class.new do
          def outgoing(message, callback)
            message["ext"] = {"auth" => "password"}
            callback.call(message)
          end
        end
        @client.add_extension(extension.new)
      end

      it "passes the handshake message through the extension" do
        dispatcher.should_receive(:send_message).with({
          "channel" => "/meta/handshake",
          "version" => "1.0",
          "supportedConnectionTypes" => ["fake-transport", "another-transport"],
          "id"      => instance_of(String),
          "ext"     => {"auth" => "password"}
        }, 72, {})
        @client.handshake
      end
    end

    describe "on successful response" do
      before do
        stub_response "channel"    => "/meta/handshake",
                      "successful" => true,
                      "version"    => "1.0",
                      "supportedConnectionTypes" => ["long-polling", "websocket"],
                      "clientId"   => "handshakeid"
      end

      it "stores the clientId" do
        @client.handshake
        dispatcher.client_id.should == "handshakeid"
      end

      it "puts the client in the CONNECTED state" do
        @client.handshake
        @client.instance_eval { @state }.should == Faye::Client::CONNECTED
      end

      it "registers any pre-existing subscriptions" do
        @client.should_receive(:subscribe).with([], true)
        @client.handshake
      end

      it "selects a new transport based on what the server supports" do
        dispatcher.should_receive(:select_transport).with(["long-polling", "websocket"])
        @client.handshake
      end
    end

    describe "on unsuccessful response" do
      before do
        stub_response "channel"    => "/meta/handshake",
                      "successful" => false,
                      "version"    => "1.0",
                      "supportedConnectionTypes" => ["websocket"]
      end

      it "schedules a retry" do
        EM.should_receive(:add_timer)
        @client.handshake
      end

      it "puts the client in the UNCONNECTED state" do
        @client.handshake
        @client.instance_eval { @state }.should == Faye::Client::UNCONNECTED
      end
    end

    describe "with existing subscriptions after a server restart" do
      before do
        create_connected_client

        @message = nil
        subscribe @client, "/messages/foo", lambda { |m| @message = m }

        @client.__send__(:receive_message, "advice" => {"reconnect" => "handshake"})

        stub_response "channel"    => "/meta/handshake",
                      "successful" => true,
                      "version"    => "1.0",
                      "supportedConnectionTypes" => ["websocket"],
                      "clientId"   => "reconnectid"
      end

      it "resends the subscriptions to the server" do
        dispatcher.should_receive(:send_message).with(hash_including("channel" => "/meta/handshake"), 72, {})
        dispatcher.should_receive(:send_message).with({
          "channel"      => "/meta/subscribe",
          "clientId"     => "reconnectid",
          "subscription" => "/messages/foo",
          "id"           => instance_of(String)
        }, 72, {})
        @client.handshake
      end

      it "retains the listeners for the subscriptions" do
        @client.handshake
        @client.__send__(:receive_message, "channel" => "/messages/foo", "data" => "ok")
        @message.should == "ok"
      end
    end

    describe "with a connected client" do
      before { create_connected_client }

      it "does not send a handshake message to the server" do
        dispatcher.should_not_receive(:send_message).with({
          "channel" => "/meta/handshake",
          "version" => "1.0",
          "supportedConnectionTypes" => ["fake-transport", "another-transport"],
          "id"      => instance_of(String)
        }, 72, {})
        @client.handshake
      end
    end
  end

  describe :connect do
    describe "with an unconnected client" do
      before do
        stub_response "channel"    => "/meta/handshake",
                      "successful" => true,
                      "version"    => "1.0",
                      "supportedConnectionTypes" => ["websocket"],
                      "clientId"   => "handshakeid"

        create_client
      end

      it "handshakes before connecting" do
        dispatcher.should_receive(:send_message).with({
          "channel"        => "/meta/connect",
          "clientId"       => "handshakeid",
          "connectionType" => "fake-transport",
          "id"             => instance_of(String)
        }, 72, {})
        @client.connect
      end
    end

    describe "with a connected client" do
      before { create_connected_client }

      it "sends a connect message to the server" do
        dispatcher.should_receive(:send_message).with({
          "channel"        => "/meta/connect",
          "clientId"       => "fakeid",
          "connectionType" => "fake-transport",
          "id"             => instance_of(String)
        }, 72, {})
        @client.connect
      end

      it "only opens one connect request at a time" do
        dispatcher.should_receive(:send_message).with({
          "channel"        => "/meta/connect",
          "clientId"       => "fakeid",
          "connectionType" => "fake-transport",
          "id"             => instance_of(String)
        }, 72, {}).
        exactly(1).
        and_return(nil) # override stub implementation

        @client.connect
        @client.connect
      end
    end
  end

  describe :disconnect do
    before { create_connected_client }

    it "sends a disconnect message to the server" do
      dispatcher.stub(:close)
      dispatcher.should_receive(:send_message).with({
        "channel"  => "/meta/disconnect",
        "clientId" => "fakeid",
        "id"       => instance_of(String)
      }, 72, {})
      @client.disconnect
    end

    it "puts the client in the DISCONNECTED state" do
      dispatcher.stub(:close)
      @client.disconnect
      @client.instance_eval { @state }.should == Faye::Client::DISCONNECTED
    end

    describe "on successful response" do
      before do
        stub_response "channel"    => "/meta/disconnect",
                      "successful" => true,
                      "clientId"   => "fakeid"
      end

      it "closes the dispatcher" do
        dispatcher.should_receive(:close)
        @client.disconnect
      end
    end
  end

  describe :subscribe do
    before do
      create_connected_client
      @subscribe_message = {
          "channel"      => "/meta/subscribe",
          "clientId"     => "fakeid",
          "subscription" => "/foo/*",
          "id"           => instance_of(String)
        }
    end

    describe "with no prior subscriptions" do
      it "sends a subscribe message to the server" do
        dispatcher.should_receive(:send_message).with(@subscribe_message, 72, {})
        @client.subscribe("/foo/*")
      end

      # The Bayeux spec says the server should accept a list of subscriptions
      # in one message but the cometD server doesn't actually support this
      describe "with an array of subscriptions" do
        it "sends multiple subscribe messages" do
          dispatcher.should_receive(:send_message).with({
            "channel"      => "/meta/subscribe",
            "clientId"     => "fakeid",
            "subscription" => "/foo",
            "id"           => instance_of(String)
          }, 72, {})
          dispatcher.should_receive(:send_message).with({
            "channel"      => "/meta/subscribe",
            "clientId"     => "fakeid",
            "subscription" => "/bar",
            "id"           => instance_of(String)
          }, 72, {})
          @client.subscribe(["/foo", "/bar"])
        end

        it "returns an array of subscriptions" do
          subs = @client.subscribe(["/foo", "/bar"])
          subs.size.should == 2
          subs.should be_all { |s| Faye::Subscription === s }
        end
      end

      describe "on successful response" do
        before do
          stub_response "channel"      => "/meta/subscribe",
                        "successful"   => true,
                        "clientId"     => "fakeid",
                        "subscription" => "/foo/*"
        end

        it "sets up a listener for the subscribed channel" do
          @message = nil
          @client.subscribe("/foo/*") { |m| @message = m }
          @client.__send__(:receive_message, "channel" => "/foo/bar", "data" => "hi")
          @message.should == "hi"
        end

        it "does not call the listener for non-matching channels" do
          @message = nil
          @client.subscribe("/foo/*") { |m| @message = m }
          @client.__send__(:receive_message, "channel" => "/bar", "data" => "hi")
          @message.should be_nil
        end

        it "activates the subscription" do
          active = false
          @client.subscribe("/foo/*").callback { active = true }
          active.should be true
        end

        describe "with an incoming extension installed" do
          before do
            extension = Class.new do
              def incoming(message, callback)
                message["data"]["changed"] = true if message["data"]
                callback.call(message)
              end
            end
            @client.add_extension(extension.new)
            @message = nil
            @client.subscribe("/foo/*") { |m| @message = m }
          end

          it "passes delivered messages through the extension" do
            @client.__send__(:receive_message, "channel" => "/foo/bar", "data" => {"hello" => "there"})
            @message.should == {"hello" => "there", "changed" => true}
          end
        end

        describe "with an outgoing extension installed" do
          before do
            extension = Class.new do
              def outgoing(message, callback)
                message["data"]["changed"] = true if message["data"]
                callback.call(message)
              end
            end
            @client.add_extension(extension.new)
            @message = nil
            @client.subscribe("/foo/*") { |m| @message = m }
          end

          it "leaves messages unchanged" do
            @client.__send__(:receive_message, "channel" => "/foo/bar", "data" => {"hello" => "there"})
            @message.should == {"hello" => "there"}
          end
        end

        describe "with an incoming extension that invalidates the response" do
          before do
            extension = Class.new do
              def incoming(message, callback)
                message["successful"] = false if message["channel"] == "/meta/subscribe"
                callback.call(message)
              end
            end
            @client.add_extension(extension.new)
          end

          it "does not set up a listener for the subscribed channel" do
            @message = nil
            @client.subscribe("/foo/*") { |m| @message = m }
            @client.__send__(:receive_message, "channel" => "/foo/bar", "data" => "hi")
            @message.should be_nil
          end

          it "does not activate the subscription" do
            active = false
            @client.subscribe("/foo/*").callback { active = true }
            active.should be false
          end
        end
      end

      describe "on unsuccessful response" do
        before do
          stub_response "channel"      => "/meta/subscribe",
                        "error"        => "403:/meta/foo:Forbidden channel",
                        "successful"   => false,
                        "clientId"     => "fakeid",
                        "subscription" => "/meta/foo"
        end

        it "does not set up a listener for the subscribed channel" do
          @message = nil
          @client.subscribe("/meta/foo") { |m| @message = m }
          @client.__send__(:receive_message, "channel" => "/meta/foo", "data" => "hi")
          @message.should be_nil
        end

        it "does not activate the subscription" do
          active = false
          @client.subscribe("/meta/foo").callback { active = true }
          active.should be false
        end

        it "reports the error through an errback" do
          error = nil
          @client.subscribe("/meta/foo").errback { |e| error = e }
          error.code.should == 403
          error.params.should == ["/meta/foo"]
          error.message.should == "Forbidden channel"
        end
      end
    end

    describe "with an existing subscription" do
      before do
        subscribe @client, "/foo/*"
      end

      it "does not send another subscribe message to the server" do
        dispatcher.should_not_receive(:send_message).with(@subscribe_message, 72, {})
        @client.subscribe("/foo/*")
      end

      it "sets up another listener on the channel" do
        @client.subscribe("/foo/*") { @subs_called += 1 }
        @client.__send__(:receive_message, "channel" => "/foo/bar", "data" => "hi")
        @subs_called.should == 2
      end

      it "activates the subscription" do
        active = false
        @client.subscribe("/foo/*").callback { active = true }
        active.should be true
      end
    end
  end

  describe :unsubscribe do
    before do
      create_connected_client
      @unsubscribe_message = {
          "channel"      => "/meta/unsubscribe",
          "clientId"     => "fakeid",
          "subscription" => "/foo/*",
          "id"           => instance_of(String)
        }
    end

    describe "with no subscriptions" do
      it "does not send an unsubscribe message to the server" do
        dispatcher.should_not_receive(:send_message).with(@unsubscribe_message, 72, {})
        @client.unsubscribe("/foo/*")
      end
    end

    describe "with a single subscription" do
      before do
        @message = nil
        @listener = lambda { |m| @message = m }
        subscribe @client, "/foo/*", @listener
      end

      it "sends an unsubscribe message to the server" do
        dispatcher.should_receive(:send_message).with(@unsubscribe_message, 72, {})
        @client.unsubscribe("/foo/*")
      end

      it "removes the listener from the channel" do
        @client.__send__(:receive_message, "channel" => "/foo/bar", "data" => "first")
        @client.unsubscribe("/foo/*", &@listener)
        @client.__send__(:receive_message, "channel" => "/foo/bar", "data" => "second")
        @message.should == "first"
      end
    end

    describe "with multiple subscriptions to the same channel" do
      before do
        @messages = []
        @hey = lambda { |m| @messages << ("hey " + m["text"]) }
        @bye = lambda { |m| @messages << ("bye " + m["text"]) }
        subscribe @client, "/foo/*", @hey
        subscribe @client, "/foo/*", @bye
      end

      it "removes one of the listeners from the channel" do
        @client.__send__(:receive_message, "channel" => "/foo/bar", "data" => {"text" => "you"})
        @client.unsubscribe("/foo/*", &@hey)
        @client.__send__(:receive_message, "channel" => "/foo/bar", "data" => {"text" => "you"})
        @messages.should == ["hey you", "bye you", "bye you"]
      end

      it "does not send an unsubscribe message if one listener is removed" do
        dispatcher.should_not_receive(:send_message).with(@unsubscribe_message, 72, {})
        @client.unsubscribe("/foo/*", &@bye)
      end

      it "sends an unsubscribe message if each listener is removed" do
        dispatcher.should_receive(:send_message).with(@unsubscribe_message, 72, {})
        @client.unsubscribe("/foo/*", &@bye)
        @client.unsubscribe("/foo/*", &@hey)
      end

      it "sends an unsubscribe message if all listeners are removed" do
        dispatcher.should_receive(:send_message).with(@unsubscribe_message, 72, {})
        @client.unsubscribe("/foo/*")
      end
    end

    describe "with multiple subscriptions to different channels" do
      before do
        subscribe @client, "/foo"
        subscribe @client, "/bar"
      end

      it "sends multiple unsubscribe messages if given an array" do
        dispatcher.should_receive(:send_message).with({
          "channel"      => "/meta/unsubscribe",
          "clientId"     => "fakeid",
          "subscription" => "/foo",
          "id"           => instance_of(String)
        }, 72, {})
        dispatcher.should_receive(:send_message).with({
          "channel"      => "/meta/unsubscribe",
          "clientId"     => "fakeid",
          "subscription" => "/bar",
          "id"           => instance_of(String)
        }, 72, {})
        @client.unsubscribe(["/foo", "/bar"])
      end
    end
  end

  describe :publish do
    before { create_connected_client }

    it "sends the message to the server with an ID" do
      dispatcher.should_receive(:send_message).with({
        "channel"  => "/messages/foo",
        "clientId" => "fakeid",
        "data"     => {"hello" => "world"},
        "id"       => instance_of(String)
      }, 72, {})
      @client.publish("/messages/foo", "hello" => "world")
    end

    it "throws an error when publishing to an invalid channel" do
      dispatcher.should_not_receive(:send_message).with(hash_including("channel" => "/messages/*"), 72, {})
      lambda { @client.publish("/messages/*", "hello" => "world") }.should raise_error
    end

    describe "on publish failure" do
      before do
        stub_response "channel"      => "/messages/foo",
                      "error"        => "407:/messages/foo:Failed to publish",
                      "successful"   => false,
                      "clientId"     => "fakeid"
      end

      it "should not be published" do
        published = false
        @client.publish("/messages/foo", "text" => "hi").callback { published = true }
        published.should be false
      end

      it "reports the error through an errback" do
        error = nil
        @client.publish("/messages/foo", "text" => "hi").errback { |e| error = e }
        error.code.should == 407
        error.params.should == ["/messages/foo"]
        error.message.should == "Failed to publish"
      end
    end

    describe "on receipt of the published message" do
      before do
        stub_response "channel"      => "/messages/foo",
                      "data"         => {"text" => "hi"},
                      "clientId"     => "fakeid"
      end

      it "does not trigger the callbacks" do
        published = false
        publication = @client.publish("/messages/foo", "text" => "hi")
        publication.callback { published = true }
        publication.errback { published = true }
        published.should be false
      end
    end

    describe "with an outgoing extension installed" do
      before do
        extension = Class.new do
          def outgoing(message, callback)
            message["ext"] = {"auth" => "password"}
            callback.call(message)
          end
        end
        @client.add_extension(extension.new)
      end

      it "passes messages through the extension" do
        dispatcher.should_receive(:send_message).with({
          "channel"  => "/messages/foo",
          "clientId" => "fakeid",
          "data"     => {"hello" => "world"},
          "id"       => instance_of(String),
          "ext"      => {"auth" => "password"}
        }, 72, {})
        @client.publish("/messages/foo", "hello" => "world")
      end
    end

    describe "with an incoming extension installed" do
      before do
        extension = Class.new do
          def incoming(message, callback)
            message["ext"] = {"auth" => "password"}
            callback.call(message)
          end
        end
        @client.add_extension(extension.new)
      end

      it "leaves the message unchanged" do
        dispatcher.should_receive(:send_message).with({
          "channel"  => "/messages/foo",
          "clientId" => "fakeid",
          "data"     => {"hello" => "world"},
          "id"       => instance_of(String)
        }, 72, {})
        @client.publish("/messages/foo", "hello" => "world")
      end
    end
  end
end
