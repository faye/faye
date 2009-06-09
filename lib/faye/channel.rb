module Faye
  class Channel
    HANDSHAKE   = '/meta/handshake'
    CONNECT     = '/meta/connect'
    SUBSCRIBE   = '/meta/subscribe'
    UNSUBSCRIBE = '/meta/unsubscribe'
    DISCONNECT  = '/meta/disconnect'
    ECHO        = '/service/echo'
    
    META        = 'meta'
    
    def self.valid?(name)
      test = (Grammar::CHANNEL_NAME =~ name)
      not test.nil?
    end
    
    def self.parse(name)
      return nil unless valid?(name)
      name.split('/')[1..-1]
    end
    
    def self.meta?(name)
      segments = parse(name)
      segments ? (segments.first == META) : nil
    end
  end
end

