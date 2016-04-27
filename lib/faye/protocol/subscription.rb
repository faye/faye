module Faye
  class Subscription
    include Deferrable

    def initialize(client, channels, callback)
      @client    = client
      @channels  = channels
      @callback  = callback
      @cancelled = false
    end

    def with_channel(&callback)
      @with_channel = callback
      self
    end

    def call(*args)
      message = args.first

      @callback.call(message['data']) if @callback
      @with_channel.call(message['channel'], message['data']) if @with_channel
    end

    def to_proc
      @to_proc ||= lambda { |*a| call(*a) }
    end

    def cancel
      return if @cancelled
      @client.unsubscribe(@channels, self)
      @cancelled = true
    end

    def unsubscribe
      cancel
    end

  end
end
