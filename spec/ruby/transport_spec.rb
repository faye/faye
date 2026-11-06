require "spec_helper"

describe Faye::Transport do
  before do
    Faye.ensure_reactor_running!
  end

  let :dispatcher do
    double(:dispatcher, :endpoint_for     => URI.parse("http://example.com/"),
                        :endpoint         => URI.parse("http://example.com/"),
                        :max_request_size => 2048,
                        :cookies          => CookieJar::Jar.new,
                        :headers          => {},
                        :proxy            => {},
                        :tls              => { :verify_peer => true },
                        :transports       => {},
                        :ws_extensions    => [])
  end

  describe :get do
    before do
      Faye::Transport::Local.stub(:usable?).and_yield(false)
      Faye::Transport::Http.stub(:usable?).and_yield(false)
    end

    def get_transport(connection_types)
      transport = nil
      Faye::Transport.get(dispatcher, connection_types, []) { |t| transport = t }
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

      it "does not return disabled types" do
        Faye::Transport.get dispatcher, ["long-polling", "in-process"], ["in-process"] do |t|
          t.should be_kind_of(Faye::Transport::Http)
        end
      end

      it "allows types to be specifically selected" do
        local_transport.should be_kind_of(Faye::Transport::Local)
        http_transport.should be_kind_of(Faye::Transport::Http)
      end
    end
  end

  describe :send_message do
    include RSpec::EM::FakeClock
    before { clock.stub }
    after { clock.reset }

    before do
      dispatcher.stub(:client_id).and_return("abc123")
    end

    def send_message(message)
      @transport.send_message(message)
    end

    describe "for batching transports" do
      before do
        transport_klass = Class.new(Faye::Transport) do
          def batching?
            true
          end
        end
        @transport = transport_klass.new(dispatcher, dispatcher.endpoint)
      end

      it "does not make an immediate request" do
        @transport.should_not_receive(:request)
        send_message({ "batch" => "me" })
      end

      it "queues the message to be sent after a timeout" do
        @transport.should_receive(:request).with([{ "batch" => "me" }]).once
        send_message({ "batch" => "me" })
        clock.tick(0.01)
      end

      it "allows multiple messages to be batched together" do
        @transport.should_receive(:request).with([{ "id" => 1 }, { "id" => 2 }]).once
        send_message({ "id" => 1 })
        send_message({ "id" => 2 })
        clock.tick(0.01)
      end

      it "adds advice to connect messages sent with others" do
        @transport.should_receive(:request).with([{ "channel" => "/meta/connect", "advice" => { "timeout" => 0 }}, {}]).once
        send_message({ "channel" => "/meta/connect" })
        send_message({})
        clock.tick(0.01)
      end

      it "adds no advice to connect messages sent alone" do
        @transport.should_receive(:request).with([{ "channel" => "/meta/connect" }]).once
        send_message({ "channel" => "/meta/connect" })
        clock.tick(0.01)
      end
    end

    describe "for HTTP batches" do
      before do
        @transport = Faye::Transport::Http.new(dispatcher, dispatcher.endpoint)
      end

      it "does not request or cancel a scheduled publish when flushing an empty outbox" do
        @transport.should_not_receive(:request)
        @transport.should_not_receive(:remove_timeout)
        @transport.send(:flush)
      end

      [0, 1].each do |excess|
        it "schedules a sole message #{excess == 0 ? 'at' : 'above'} the size limit without an empty request" do
          message = { "channel" => "/test", "data" => "payload" }
          size = @transport.encode([message]).size
          dispatcher.stub(:max_request_size).and_return(size - excess)
          requests = []
          @transport.stub(:request) { |messages| requests << messages; :request }

          promise = send_message(message)
          result = nil
          promise.callback { |request| result = request }
          requests.should == []
          result.should be_nil

          clock.tick(0.01)
          requests.should == [[message]]
          result.should == :request

          next_message = { "id" => 2 }
          send_message(next_message).should_not equal(promise)
          requests.should == [[message]]
          clock.tick(0.01)
          requests.should == [[message], [next_message]]
        end
      end

      it "flushes an ordinary prefix and schedules the oversized message in payload order" do
        connect = { "channel" => "/meta/connect" }
        ordinary = { "channel" => "/test", "data" => "small" }
        oversized = { "channel" => "/test", "data" => "x" * 2048 }
        requests = []
        @transport.stub(:request) { |messages| requests << messages }

        send_message(connect)
        send_message(ordinary)
        requests.should == []
        send_message(oversized)
        requests.should == [[connect, ordinary]]
        connect["advice"].should == { "timeout" => 0 }

        clock.tick(0.01)
        requests.should == [[connect, ordinary], [oversized]]
        oversized.should == { "channel" => "/test", "data" => "x" * 2048 }
        clock.tick(0.01)
        requests.size.should == 2
      end
    end

    describe "for non-batching transports" do
      before do
        transport_klass = Class.new(Faye::Transport) do
          def batching?
            false
          end
        end
        @transport = transport_klass.new(dispatcher, dispatcher.endpoint)
      end

      it "makes a request immediately" do
        @transport.should_receive(:request).with([{ "no" => "batch" }]).once
        send_message({ "no" => "batch" })
        clock.tick(0.01)
      end
    end
  end
end
