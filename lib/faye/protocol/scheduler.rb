module Faye
  class Scheduler

    def initialize(message, options)
      @message  = message
      @options  = options
      @attempts = 0
    end

    def interval
      @options[:interval]
    end

    def timeout
      @options[:timeout]
    end

    def deliverable?
      attempts = @options[:attempts]
      deadline = @options[:deadline]
      now      = Time.now.to_f

      return false if attempts and @attempts >= attempts
      return false if deadline and now > deadline

      true
    end

    def send!
      @attempts += 1
    end

    def succeed!
    end

    def fail!
    end

    def abort!
    end

  end
end
