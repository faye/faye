module Faye
  class Subscription
    
    def initialize(client, channels, callback)
      @client    = client
      @channels  = channels
      @callback  = callback
      @cancelled = false
    end
    
    def cancel
      return if @cancelled
      @client.unsubscribe(@channels, &@callback)
      @cancelled = true
    end
    
    def unsubscribe
      cancel
    end
    
  end
end

