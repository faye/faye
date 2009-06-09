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
    
    class Tree
      include Enumerable
      attr_accessor :value
      
      def initialize(value = nil)
        @value = value
        @children = {}
      end
      
      def each_child(&block)
        @children.each { |key, subtree| block.call(key, subtree) }
      end
      
      def each(prefix = [], &block)
        each_child { |path, subtree| subtree.each(prefix + [path], &block) }
        block.call(prefix, @value) unless @value.nil?
      end
      
      def [](name)
        subtree = traverse(name)
        subtree ? subtree.value : nil
      end
      
      def []=(name, value)
        subtree = traverse(name, true)
        subtree.value = value unless subtree.nil?
      end
      
      def traverse(path, create_if_absent = false)
        path = Channel.parse(path) if String === path
        return nil if path.nil?
        return self if path.empty?
        subtree = @children[path.first]
        return nil if subtree.nil? and not create_if_absent
        subtree = @children[path.first] = self.class.new if subtree.nil?
        subtree.traverse(path[1..-1], create_if_absent)
      end
    end
    
  end
end

