module Faye
  module Engine
    module Callbacks

      # We're not doing arounds, because of the async nature of the beast.
      TYPES = [ :before, :after ].freeze
      METHODS = [ :create_client, :destroy_client, :client_exists, :subscribe, :unsubscribe, :publish ].freeze

      # Set a callback on the Faye::Engine to call the given block when
      # the event happens.
      # 
      # Before callbacks will receive the original method arguments, after
      # callbacks will receive the result arguments as called-back from
      # the engine method.
      def set_callback(type, method, &callback)
        raise ArgumentError, ":#{type.to_s} is not valid." unless TYPES.member? type
        raise ArgumentError, ":#{method.to_s} is not a valid API method." unless METHODS.member? method

        raise ArgumentError, "Unable to add a before create_client callback." if (type == :before) && (method == :create_client)
        raise ArgumentError, "Unable to add an after publish callback." if (type == :after) && (method == :publish)

        send("_define_callback_hook_method", method)
        send("_add_#{type.to_s}_method_callback", method, &callback)
      end

      private

      def _add_before_method_callback(method, &callback)
        @before_callbacks ||= {}
        if @before_callbacks[method]
          @before_callbacks[method] = proc { |*args| callback.call(*args, &@before_callbacks[method]) }
        else
          @before_callbacks[method] = callback
        end
      end

      def _top_before_callback(method)
        @before_callbacks ||= {}
        @before_callbacks[method] || proc { |*args,&resume| resume.call(*args) }
      end

      def _add_after_method_callback(method, &callback)
        @after_callbacks ||= {}
        if @after_callbacks[method]
          @after_callbacks[method] = proc { |*args| callback.call(*args, &@after_callbacks[method]) }
        else
          @after_callbacks[method] = callback
        end
      end

      def _top_after_callback(method)
        @after_callbacks ||= {}
        @after_callbacks[method] || proc { |*args,&resume| resume.call(*args) }
      end

      def _define_callback_hook_method(method)
        hook_method = "#{method.to_s}_with_callback_hooks".to_sym
        unless respond_to? hook_method
          self.class.class_eval <<-RUBY
              def #{hook_method.to_s}(*args, &callback)
                _top_before_callback(:#{method.to_s}).call(*args) do |*args|
                  #{method.to_s}_without_callback_hooks(*args) do |*args|
                    _top_after_callback(:#{method.to_s}).call(*args, &callback)
                  end
                end
              end
              alias :#{method.to_s}_without_callback_hooks :#{method.to_s}
              alias :#{method.to_s} #{hook_method.to_s}
            RUBY
        end
      end

    end

  end
end
