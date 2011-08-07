require "spec_helper"

TcpSteps = EM::RSpec.async_steps do
  class SocketPool
    def initialize
      @sockets = {}
    end
    
    def with_socket(port, &block)
      return @sockets[port].callback(&block) if @sockets[port]
      EM.connect("localhost", port, Faye::Transport::Tcp::Connection) do |connection|
        @sockets[port] = Socket.new(connection, &block)
      end
    end
    
    class Socket
      include EM::Deferrable
      
      def initialize(connection, &block)
        @connection = connection
        @connection.parent = self
        callback(&block)
      end
      
      def on_open
        set_deferred_status(:succeeded, @connection)
      end
      
      def on_message(message)
      end
      
      def on_close
      end
    end
  end
  
  def start_server(port, &callback)
    @server_id = adapter.listen(port)
    @sockets   = SocketPool.new
    EM.add_timer(0.01, &callback)
  end
  
  def stop_server(&callback)
    EM.stop_server(@server_id)
    EM.add_timer(0.01, &callback)
  end
  
  def send(port, message, &callback)
    @sockets.with_socket(port) do |socket|
      socket.send(message)
      EM.add_timer(0.01, &callback)
    end
  end
  
  def should_receive(port, message, &callback)
    @sockets.with_socket(port) do |socket|
      socket.should_receive(:on_message).with(JSON.dump(message))
      callback.call
    end
  end
  
  def should_not_receive(port, &callback)
    @sockets.with_socket(port) do |socket|
      socket.should_not_receive(:on_message)
      callback.call
    end
  end
end

describe Faye::Adapter::Tcp do
  include TcpSteps
  
  let(:adapter) { Faye::Adapter::Tcp.new(options) }
  let(:options) { {:mount => "/bayeux", :timeout => 30} }
  let(:server)  { mock "server" }
  
  before do
    Faye.ensure_reactor_running!
    types = Faye::Adapter::Tcp::CONNECTION_TYPES
    Faye::Server.should_receive(:new).with(types, options).and_return server
    adapter.stub(:get_client).and_return mock("client")
  end
  
  before { start_server 8000 }
  after  { stop_server  }
  
  it "forwards JSON messages onto the server" do
    server.should_receive(:process).with({"channel" => "/foo"}, false).and_yield []
    send 8000, '{"channel":"/foo"}'
  end
  
  it "returns the server's response as JSON" do
    server.stub(:process).and_yield ["channel" => "/meta/handshake"]
    should_receive 8000, ["channel" => "/meta/handshake"]
    send 8000, '[]'
  end
  
  it "receives nothing if invalid JSON is given" do
    server.should_not_receive(:process)
    should_not_receive 8000
    send 8000, '[}'
  end
end

