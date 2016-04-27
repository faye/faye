module Faye
  class Channel

    include Publisher
    attr_reader :name

    def initialize(name)
      super()
      @name = name
    end

    def <<(message)
      trigger(:message, message)
    end

    def unused?
      listener_count(:message).zero?
    end

    HANDSHAKE   = '/meta/handshake'
    CONNECT     = '/meta/connect'
    SUBSCRIBE   = '/meta/subscribe'
    UNSUBSCRIBE = '/meta/unsubscribe'
    DISCONNECT  = '/meta/disconnect'

    META        = 'meta'
    SERVICE     = 'service'

    class << self
      def expand(name)
        segments = parse(name)
        channels = ['/**', name]

        copy = segments.dup
        copy[copy.size - 1] = '*'
        channels << unparse(copy)

        1.upto(segments.size - 1) do |i|
          copy = segments[0...i]
          copy << '**'
          channels << unparse(copy)
        end

        channels
      end

      def valid?(name)
        Grammar::CHANNEL_NAME =~ name or
        Grammar::CHANNEL_PATTERN =~ name
      end

      def parse(name)
        return nil unless valid?(name)
        name.split('/')[1..-1]
      end

      def unparse(segments)
        '/' + segments.join('/')
      end

      def meta?(name)
        segments = parse(name)
        segments ? (segments.first == META) : nil
      end

      def service?(name)
        segments = parse(name)
        segments ? (segments.first == SERVICE) : nil
      end

      def subscribable?(name)
        return nil unless valid?(name)
        not meta?(name) and not service?(name)
      end
    end

    class Set
      def initialize
        @channels = {}
      end

      def keys
        @channels.keys
      end

      def remove(name)
        @channels.delete(name)
      end

      def has_subscription?(name)
        @channels.has_key?(name)
      end

      def subscribe(names, subscription)
        names.each do |name|
          channel = @channels[name] ||= Channel.new(name)
          channel.bind(:message, &subscription)
        end
      end

      def unsubscribe(name, subscription)
        channel = @channels[name]
        return false unless channel
        channel.unbind(:message, &subscription)
        if channel.unused?
          remove(name)
          true
        else
          false
        end
      end

      def distribute_message(message)
        channels = Channel.expand(message['channel'])
        channels.each do |name|
          channel = @channels[name]
          channel.trigger(:message, message) if channel
        end
      end
    end

  end
end
