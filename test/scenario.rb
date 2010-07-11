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
    return finish if command.nil?
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
  
  def finish
    @scenario.finish { EM.stop }
  end
  
  class AsyncScenario
    include Test::Unit::Assertions
    
    def initialize
      @clients = {}
      @inbox   = {}
      @errors  = {}
      @pool    = 0
    end
    
    def wait(time, &block)
      EM.add_timer(time, &block)
    end
  
    def check_inbox(expected_inbox, &block)
      assert_equal expected_inbox, @inbox
      EM.next_tick(&block)
    end
    
    def check_errors(name, expected_errors, &block)
      assert_equal expected_errors, @errors[name]
      EM.next_tick(&block)
    end
    
    def server(port, &block)
      @endpoint = "http://0.0.0.0:#{port}/bayeux"
      @bayeux = Faye::RackAdapter.new(:mount => '/bayeux', :timeout => 30)
      Rack::Handler.get('thin').run(@bayeux, :Port => port) do |server|
        @server = server
        EM.next_tick(&block)
      end
    end
    
    def http_client(name, channels, &block)
      setup_client(Faye::Client.new(@endpoint), name, channels, &block)
    end
    
    def local_client(name, channels, &block)
      setup_client(@bayeux.get_client, name, channels, &block)
    end
    
    def extend_server(stage, extension, &block)
      object = Object.new
      def object.added
        @active = true
      end
      (class << object; self; end).send(:define_method, stage) do |*args|
        extension.call(*args) if @active
      end
      @bayeux.add_extension(object)
      block.call
    end
    
    def extend_client(name, stage, extension, &block)
      object = Object.new
      (class << object; self; end).send(:define_method, stage, &extension)
      @clients[name].add_extension(object)
      block.call
    end
    
    def listen_for_errors(name, &block)
      @errors[name] = []
      extend_client(name, :incoming, lambda { |message, callback|
        if message['successful'] == false
          @errors[name] << message['error']
        end
        callback.call(message)
      }, &block)
    end
    
    def setup_client(client, name, channels, &block)
      @clients[name] = client
      @inbox[name]   = {}
      @pool         += 1
      
      channels.each { |channel| subscribe(name, channel) }
      EM.add_timer(0.5 * channels.size, &block)
    end
    
    def subscribe(name, channel, &block)
      client = @clients[name]
      
      @last_sub = client.subscribe(channel) do |message|
        box = @inbox[name]
        box[channel] ||= []
        box[channel] << message
      end
      
      EM.add_timer(0.5, &block)
    end
    
    def cancel_last_subscription(&block)
      @last_sub.cancel
      EM.add_timer(0.5, &block)
    end
    
    def publish(from, channel, messages, &block)
      messages = [messages].flatten
      messages.each { |msg| @clients[from].publish(channel, msg) }
      EM.add_timer(2, &block)
    end
    
    def finish(&block)
      @clients.each { |id,c| c.disconnect }
      EM.add_timer(1) do
        @server.stop!
        block.call
      end
    end
  end
  
end

