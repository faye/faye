module Faye
  module Grammar
    
    def self.rule(&block)
      source = instance_eval(&block)
      %r{^#{source}$}
    end
    
    def self.choice(*list)
      '(' + list.map(&method(:string)) * '|' + ')'
    end
    
    def self.repeat(pattern)
      string(pattern) + '*'
    end
    
    def self.oneormore(pattern)
      string(pattern) + '+'
    end
    
    def self.string(item)
      String === item ? item : item.source.gsub(/^\^/, '').gsub(/\$$/, '')
    end
    
  end
end

