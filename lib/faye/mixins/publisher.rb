module Faye
  module Publisher

    include ::WebSocket::Driver::EventEmitter

    alias :bind    :add_listener
    alias :trigger :emit

    def unbind(event, &listener)
      if listener
        remove_listener(event, &listener)
      else
        remove_all_listeners(event)
      end
    end

  end
end
