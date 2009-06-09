module Faye
  class Channel
    HANDSHAKE   = '/meta/handshake'
    CONNECT     = '/meta/connect'
    SUBSCRIBE   = '/meta/subscribe'
    UNSUBSCRIBE = '/meta/unsubscribe'
    DISCONNECT  = '/meta/disconnect'
    ECHO        = '/service/echo'
    
    META        = 'meta'
    
    class << self
      def valid?(name)
        test = (Grammar::CHANNEL_NAME =~ name)
        not test.nil?
      end
      
      def parse(name)
        return nil unless valid?(name)
        name.split('/')[1..-1]
      end
      
      def meta?(name)
        segments = parse(name)
        segments ? (segments.first == META) : nil
      end
    end
    
    attr_reader :name
    
    def initialize(name)
      @name    = name
      @clients = []
    end
    
    def <<(client)
      @clients << client
    end
  end
end

