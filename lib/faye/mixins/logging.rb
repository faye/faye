module Faye
  module Logging

    DEFAULT_LOG_LEVEL = :error

    LOG_LEVELS = {
      :error  => 3,
      :warn   => 2,
      :info   => 1,
      :debug  => 0
    }

    class << self
      attr_writer :log_level

      def log_level
        @log_level || DEFAULT_LOG_LEVEL
      end
    end

    attr_writer :log_level

    def log_level
      @log_level || Logging.log_level
    end

    def log(message_args, level)
      return unless Faye.logger
      return if LOG_LEVELS[log_level] > LOG_LEVELS[level]

      message = message_args.shift.gsub(/\?/) do
        Faye.to_json(message_args.shift)
      end

      timestamp = Time.now.strftime('%Y-%m-%d %H:%M:%S')
      banner = " [#{ level.to_s.upcase }] [#{ self.class.name }] "

      Faye.logger.call(timestamp + banner + message)
    end

    LOG_LEVELS.each do |level, value|
      define_method(level) { |*args| log(args, level) }
    end

  end
end

