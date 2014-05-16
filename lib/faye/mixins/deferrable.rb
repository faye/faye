module Faye
  module Deferrable

    include EventMachine::Deferrable

    def set_deferred_status(status, *args)
      if status == :unknown
        @deferred_status = @deferred_args = @callbacks = @errbacks = nil
      end
      super
    end

  end
end
