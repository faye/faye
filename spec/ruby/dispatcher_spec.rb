require "spec_helper"

describe Faye::Dispatcher do
  include RSpec::EM::FakeClock

  let(:client)    { double(:client, :trigger => nil) }
  let(:endpoint)  { "http://localhost/" }
  let(:transport) { double(:transport, :endpoint => URI.parse(endpoint), :connection_type => "long-polling") }
  let(:options)   { {} }

  before do
    allow(Faye::Transport).to receive(:get).and_yield(transport)
    @dispatcher = Faye::Dispatcher.new(client, endpoint, options)
    clock.stub
  end

  after do
    clock.reset
  end

  describe :endpoint_for do
    let(:options) { {:endpoints => {"websocket" => "http://sockets/"}} }

    it "returns the main endpoint for unspecified connection types" do
      expect(@dispatcher.endpoint_for("long-polling").to_s).to eq("http://localhost/")
    end

    it "returns an alternate endpoint where specified" do
      expect(@dispatcher.endpoint_for("websocket").to_s).to eq("http://sockets/")
    end
  end

  describe :select_transport do
    let(:connection_types) { ["long-polling", "callback-polling", "websocket"] }

    it "asks Transport to select one of the given transports" do
      expect(Faye::Transport).to receive(:get).with(@dispatcher, connection_types, []).and_yield(transport)
      @dispatcher.select_transport(connection_types)
    end

    it "asks Transport not to select disabled transports" do
      @dispatcher.disable("websocket")
      expect(Faye::Transport).to receive(:get).with(@dispatcher, connection_types, ["websocket"]).and_yield(transport)
      @dispatcher.select_transport(connection_types)
    end

    it "sets connection_type on the dispatcher" do
      allow(transport).to receive(:connection_type).and_return("transport-connection-type")
      @dispatcher.select_transport(connection_types)
      expect(@dispatcher.connection_type).to eq("transport-connection-type")
    end

    it "closes the existing transport if a new one is selected" do
      old_transport = double(:old_transport, :connection_type => "old-transport", :endpoint => URI.parse(endpoint))
      allow(Faye::Transport).to receive(:get).with(@dispatcher, ["long-polling"], []).and_yield(old_transport)
      @dispatcher.select_transport(["long-polling"])

      expect(old_transport).to receive(:close).exactly(1)
      @dispatcher.select_transport(connection_types)
    end

    it "does not close the existing transport if the same one is selected" do
      @dispatcher.select_transport(["long-polling"])

      expect(transport).to receive(:close).exactly(0)
      @dispatcher.select_transport(connection_types)
    end
  end

  describe :messaging do
    let(:message) { {'id' => 1} }
    let(:request) { double(:request) }

    let :req_promise do
      promise = EventMachine::DefaultDeferrable.new
      promise.succeed(request)
      promise
    end

    before do
      allow(transport).to receive(:close)
      allow(transport).to receive(:send_message).and_return(req_promise)

      @dispatcher.select_transport([])
    end

    describe :send_message do
      it "does not send a message to the transport if closed" do
        @dispatcher.close
        expect(transport).to receive(:send_message).exactly(0)
        @dispatcher.send_message(message, 25)
      end

      it "sends a message to the transport" do
        expect(transport).to receive(:send_message).with({'id' => 1}).exactly(1).and_return(req_promise)
        @dispatcher.send_message(message, 25)
      end

      it "sends several different messages to the transport" do
        expect(transport).to receive(:send_message).with({'id' => 1}).exactly(1).and_return(req_promise)
        expect(transport).to receive(:send_message).with({'id' => 2}).exactly(1).and_return(req_promise)
        @dispatcher.send_message({'id' => 1}, 25)
        @dispatcher.send_message({'id' => 2}, 25)
      end

      it "does not resend a message if it's already being sent" do
        expect(transport).to receive(:send_message).with({'id' => 1}).exactly(1).and_return(req_promise)
        @dispatcher.send_message(message, 25)
        @dispatcher.send_message(message, 25)
      end

      it "sets a timeout to fail the message" do
        @dispatcher.send_message(message, 25)
        expect(@dispatcher).to receive(:handle_error).with({'id' => 1}).exactly(1)
        clock.tick(25)
      end
    end

    describe :handle_error do
      before do
        @dispatcher.send_message(message, 25)
      end

      it "does not try to resend messages immediately" do
        @dispatcher.handle_error(message)
        expect(transport).not_to receive(:send_message)
      end

      it "resends messages immediately if instructed" do
        expect(transport).to receive(:send_message).with({'id' => 1}).exactly(1).and_return(req_promise)
        @dispatcher.handle_error(message, true)
      end

      it "resends a message automatically after a timeout on error" do
        @dispatcher.handle_error(message)
        expect(transport).to receive(:send_message).with({'id' => 1}).exactly(1).and_return(req_promise)
        clock.tick(5.5)
      end

      it "does not resend a message with an ID it does not recognize" do
        @dispatcher.handle_error({'id' => 2})
        expect(transport).not_to receive(:send_message)
        clock.tick(5.5)
      end

      it "does not resend a message if it's waiting to resend" do
        @dispatcher.handle_error(message)
        expect(transport).not_to receive(:send_message)
        clock.tick(2.5)
        @dispatcher.send_message(message, 25)
      end

      it "does not schedule another resend if an error is reported while a resend is scheduled" do
        expect(transport).to receive(:send_message).with({'id' => 1}).exactly(1)
        @dispatcher.handle_error(message)
        clock.tick(2.5)
        @dispatcher.handle_error(message)
        clock.tick(5.5)
      end

      it "emits the transport:down event via the client" do
        expect(client).to receive(:trigger).with("transport:down").exactly(1)
        @dispatcher.handle_error(message)
      end

      it "only emits transport:down once, when the first error is received" do
        @dispatcher.send_message({'id' => 2}, 25)
        expect(client).to receive(:trigger).with("transport:down").exactly(1)
        @dispatcher.handle_error({'id' => 1})
        @dispatcher.handle_error({'id' => 2})
      end

      it "emits transport:down again if there was a message since the last event" do
        @dispatcher.send_message({'id' => 2}, 25)
        expect(client).to receive(:trigger).with("transport:down").exactly(2)
        @dispatcher.handle_error({'id' => 1})
        @dispatcher.handle_response({'id' => 3})
        @dispatcher.handle_error({'id' => 2})
      end
    end

    describe :handle_response do
      before do
        @dispatcher.send_message(message, 25)
      end

      it "clears the timeout to resend the message if successful=true" do
        expect(@dispatcher).to receive(:handle_error).exactly(0)
        @dispatcher.handle_response({'id' => 1, 'successful' => true})
        clock.tick(25)
      end

      it "clears the timeout to resend the message if successful=false" do
        expect(@dispatcher).to receive(:handle_error).exactly(0)
        @dispatcher.handle_response({'id' => 1, 'successful' => false})
        clock.tick(25)
      end

      it "leaves the timeout to resend the message if successful is missing" do
        expect(@dispatcher).to receive(:handle_error).with({'id' => 1}).exactly(1)
        @dispatcher.handle_response(message)
        clock.tick(25)
      end

      it "emits the message as an event" do
        expect(@dispatcher).to receive(:trigger).with(:message, {'id' => 3}).exactly(1)
        @dispatcher.handle_response({'id' => 3})
      end

      it "emits the transport:up event via the client" do
        expect(client).to receive(:trigger).with("transport:up").exactly(1)
        @dispatcher.handle_response(message)
      end

      it "only emits transport:up once, when the first message is received" do
        expect(client).to receive(:trigger).with("transport:up").exactly(1)
        @dispatcher.handle_response({'id' => 1})
        @dispatcher.handle_response({'id' => 2})
      end

      it "emits transport:up again if there was an error since the last event" do
        expect(client).to receive(:trigger).with("transport:up").exactly(2)
        @dispatcher.handle_response({'id' => 2})
        @dispatcher.handle_error({'id' => 1})
        @dispatcher.handle_response({'id' => 3})
      end
    end
  end
end
