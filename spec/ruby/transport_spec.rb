require "spec_helper"

describe Faye::Transport do
  before do
    Faye.ensure_reactor_running!
  end

  let :client do
    double("client", :endpoint         => URI.parse("http://example.com/"),
                     :endpoints        => {},
                     :max_request_size => 256,
                     :cookies          => nil,
                     :headers          => {},
                     :transports       => {})
  end

  describe :get do
    before do
      Faye::Transport::Local.stub(:usable?).and_yield(false)
      Faye::Transport::Http.stub(:usable?).and_yield(false)
    end

    def get_transport(connection_types)
      transport = nil
      Faye::Transport.get(client, connection_types, []) { |t| transport = t }
      transport
    end

    let(:transport)       { get_transport ["long-polling", "in-process"] }
    let(:local_transport) { get_transport ["in-process"] }
    let(:http_transport)  { get_transport ["long-polling"] }

    describe "when no transport is usable" do
      it "raises an exception" do
        lambda { transport }.should raise_error
      end
    end

    describe "when a less preferred transport is usable" do
      before do
        Faye::Transport::Http.stub(:usable?).and_yield(true)
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
        Faye::Transport::Local.stub(:usable?).and_yield(true)
        Faye::Transport::Http.stub(:usable?).and_yield(true)
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

  describe :send do
    include EM::RSpec::FakeClock
    before { clock.stub }
    after { clock.reset }

    before do
      client.stub(:client_id).and_return("abc123")
    end

    def send(message)
      @transport.send(Faye::Envelope.new(message))
    end

    def envelope(message)
      EnvelopeMatcher.new(message)
    end

    describe "for batching transports" do
      before do
        transport_klass = Class.new(Faye::Transport) do
          def batching?
            true
          end
        end
        @transport = transport_klass.new(client, "")
      end

      it "does not make an immediate request" do
        @transport.should_not_receive(:request)
        send({"batch" => "me"})
      end

      it "queues the message to be sent after a timeout" do
        @transport.should_receive(:request).with([envelope("batch" => "me")])
        send({"batch" => "me"})
        clock.tick(0.01)
      end

      it "allows multiple messages to be batched together" do
        @transport.should_receive(:request).with([envelope("id" => 1), envelope("id" => 2)])
        send({"id" => 1})
        send({"id" => 2})
        clock.tick(0.01)
      end

      it "adds advice to connect messages sent with others" do
        @transport.should_receive(:request).with([envelope("channel" => "/meta/connect", "advice" => {"timeout" => 0}), envelope({})])
        send({"channel" => "/meta/connect"})
        send({})
        clock.tick(0.01)
      end

      it "adds no advice to connect messages sent alone" do
        @transport.should_receive(:request).with([envelope("channel" => "/meta/connect")])
        send({"channel" => "/meta/connect"})
        clock.tick(0.01)
      end

      it "flushes a large batch succesfully" do
        lambda {
          transport = Faye::Transport.new(client,"")
          transport.send(Faye::Envelope.new({'channel' => Faye::Channel::HANDSHAKE}))
          transport.send(Faye::Envelope.new({'channel' => Faye::Channel::HANDSHAKE}))
          transport.send(Faye::Envelope.new({'channel' => Faye::Channel::HANDSHAKE}))
          transport.send(Faye::Envelope.new({'channel' => Faye::Channel::HANDSHAKE}))
          transport.send(Faye::Envelope.new({'channel' => Faye::Channel::HANDSHAKE}))
          transport.send(Faye::Envelope.new({'channel' => Faye::Channel::HANDSHAKE}))
          transport.send(Faye::Envelope.new({'channel' => Faye::Channel::HANDSHAKE}))
          transport.send(Faye::Envelope.new({'channel' => Faye::Channel::HANDSHAKE}))
          transport.send(Faye::Envelope.new({'channel' => Faye::Channel::HANDSHAKE}))
          transport.send(Faye::Envelope.new({'channel' => Faye::Channel::HANDSHAKE}))
          transport.send(Faye::Envelope.new({'channel' => Faye::Channel::HANDSHAKE}))
          transport.send(Faye::Envelope.new({'channel' => Faye::Channel::HANDSHAKE}))
          transport.send(Faye::Envelope.new({'channel' => Faye::Channel::HANDSHAKE}))
          transport.flush_large_batch
        }.should_not raise_exception
      end
    end

    describe "for non-batching transports" do
      before do
        transport_klass = Class.new(Faye::Transport) do
          def batching?
            false
          end
        end
        @transport = transport_klass.new(client, "")
      end

      it "makes a request immediately" do
        @transport.should_receive(:request).with([envelope("no" => "batch")])
        send({"no" => "batch"})
      end
    end
  end
end
