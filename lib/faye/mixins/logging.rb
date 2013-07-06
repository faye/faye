module Faye
  module Logging

    LOG_LEVELS = {
      :fatal  => 4,
      :error  => 3,
      :warn   => 2,
      :info   => 1,
      :debug  => 0
    }

  private

    LOG_LEVELS.each do |level, value|
      define_method(level) { |*args| write_log(args, level) }
    end

    def write_log(message_args, level)
      return unless Faye.logger

      message = message_args.shift.gsub(/\?/) do
        Faye.to_json(message_args.shift)
      end

      banner = "[#{ self.class.name }] "

      Faye.logger.__send__(level, banner + message)
    end

  end
end

