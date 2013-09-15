module Faye
  class Envelope

    include Deferrable
    attr_reader :id, :message

    def initialize(message, timeout = nil)
      @id      = message['id']
      @message = message
      
      self.timeout(timeout, false) if timeout
    end

    def eql?(other)
      Envelope === other and @id == other.id
    end

    def hash
      @id.hash
    end

  end
end

