$VERBOSE = false

module Scenario
  module ClassMethods
    def scenario(name, &block)
      define_method("test: #{name}", &block)
    end
  end
  
  def self.included(klass)
    klass.extend ClassMethods
  end
  
  def setup
    Thread.new { EM.run }
    while not EM.reactor_running?; end
    @scenario = AsyncScenario.new
    @commands = []
    @started = false
  end
  
  def teardown
    while EM.reactor_running?; end
  end
  
  def run(runner)
    @runner = runner
    super
  end
  
  def method_missing(sym, *args)
    @commands << [sym, args]
    EM.next_tick { run_next_command unless @started }
  end
  
  def run_next_command
    @started = true
    command = @commands.shift
    return EM.stop if command.nil?
    begin
      @scenario.__send__(command.first, *command.last) do
        run_next_command
      end
    rescue Object => e
      @passed = false
      add_failure(e.message, e.backtrace)
      @runner.puke(self.class, self.name, e) if @runner.respond_to?(:puke)
      block.call
    end
  end
  
  class AsyncScenario
    include Test::Unit::Assertions
    
    def initialize
      @clients = {}
      @inbox   = {}
      @pool    = 0
    end
  
    def check_inbox(expected_inbox, &block)
      assert_equal expected_inbox, @inbox
      block.call
    end
    
    def server(port, &block)
      @endpoint = "http://0.0.0.0:#{port}/comet"
      @comet = Faye::RackAdapter.new(:mount => '/comet', :timeout => 30)
      Rack::Handler.get('thin').run(@comet, :Port => port) do |server|
        @server = server
        EM.next_tick(&block)
      end
    end
    
    def http_client(name, channels, &block)
      setup_client(Faye::Client.new(@endpoint), name, channels, &block)
    end
    
    def local_client(name, channels, &block)
      setup_client(@comet.get_client, name, channels, &block)
    end
    
    def setup_client(client, name, channels, &block)
      channels.each do |channel|
        client.subscribe(channel) do |message|
          box = @inbox[name]
          box[channel] ||= []
          box[channel] << message
        end
      end
      @clients[name] = client
      @inbox[name]   = {}
      @pool         += 1
      EM.add_timer(0.5 * channels.size, &block)
    end
    
    def publish(from, channel, message, &block)
      @clients[from].publish(channel, message)
      EM.add_timer(2, &block)
    end
  end
  
end

