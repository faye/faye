module Faye
  class Namespace

    extend Forwardable
    def_delegator :@used, :delete, :release
    def_delegator :@used, :has_key?, :exists?

    def initialize
      @used = {}
    end

    def generate
      name = Engine.random
      name = Engine.random while @used.has_key?(name)
      @used[name] = name
    end

  end
end
