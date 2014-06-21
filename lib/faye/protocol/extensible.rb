module Faye
  module Extensible
    include Logging

    def add_extension(extension)
      @extensions ||= []
      @extensions << extension
      extension.added(self) if extension.respond_to?(:added)
    end

    def remove_extension(extension)
      return unless @extensions
      @extensions.delete_if do |ext|
        next false unless ext == extension
        extension.removed(self) if extension.respond_to?(:removed)
        true
      end
    end

    def pipe_through_extensions(stage, message, env, &callback)
      debug('Passing through ? extensions: ?', stage, message)

      return callback.call(message) unless @extensions
      extensions = @extensions.dup

      pipe = lambda do |message|
        next callback.call(message) unless message

        extension = extensions.shift
        next callback.call(message) unless extension

        next pipe.call(message) unless extension.respond_to?(stage)

        arity = extension.method(stage).arity
        if arity >= 3
          extension.__send__(stage, message, env, pipe)
        else
          extension.__send__(stage, message, pipe)
        end
      end
      pipe.call(message)
    end

  end
end
