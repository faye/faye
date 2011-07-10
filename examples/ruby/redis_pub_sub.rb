require 'em-hiredis'

class RedisPubSub
  def initialize
    @channels = Faye::Channel::Set.new
  end
  
  def init
    return if @publisher
    
    @publisher  = EventMachine::Hiredis::Client.connect
    @subscriber = EventMachine::Hiredis::Client.connect
    
    @subscriber.on(:message) do |topic, message|
      message = JSON.parse(message)
      @channels.distribute_message('channel' => topic, 'data' => message)
    end
  end
  
  def subscribe(channel, &callback)
    init
    @subscriber.subscribe(channel)
    @channels.subscribe([channel], callback)
  end
  
  def publish(channel, data)
    init
    message = JSON.dump(data)
    @publisher.publish(channel, message)
  end
end
