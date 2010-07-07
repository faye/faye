module Faye
  module Extensible
    
    def add_extension(extension)
      @extensions ||= []
      @extensions << extension
      extension.added if extension.respond_to?(:added)
    end
    
    def remove_extension(extension)
      return unless @extensions
      @extensions.delete_if do |ext|
        if ext == extension
          extension.removed if extension.respond_to?(:removed)
          true
        else
          false
        end
      end
    end
    
    def pipe_through_extensions(stage, message, &callback)
      return callback.call(message) unless @extensions
      extensions = @extensions.dup
      
      pipe = lambda do |message|
        if !message
          callback.call(message)
        else
          extension = extensions.shift
          if (!extension)
            callback.call(message)
          else
            if extension.respond_to?(stage)
              extension.__send__(stage, message, pipe)
            else
              pipe.call(message)
            end
          end
        end
      end
      pipe.call(message)
    end
    
  end
end

