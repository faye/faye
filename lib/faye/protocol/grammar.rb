module Faye
  module Grammar

    def self.rule(&block)
      source = instance_eval(&block)
      %r{^#{string(source)}$}
    end

    def self.choice(*list)
      '(' + list.map(&method(:string)) * '|' + ')'
    end

    def self.repeat(*pattern)
      '(' + string(pattern) + ')*'
    end

    def self.oneormore(*pattern)
      '(' + string(pattern) + ')+'
    end

    def self.string(item)
      return item.map(&method(:string)) * '' if Array === item
      String === item ? item : item.source.gsub(/^\^/, '').gsub(/\$$/, '')
    end

    LOWALPHA          = rule {[ '[a-z]' ]}
    UPALPHA           = rule {[ '[A-Z]' ]}
    ALPHA             = rule {[ choice(LOWALPHA, UPALPHA) ]}
    DIGIT             = rule {[ '[0-9]' ]}
    ALPHANUM          = rule {[ choice(ALPHA, DIGIT) ]}
    MARK              = rule {[ choice(*%w[\\- \\_ \\! \\~ \\( \\) \\$ \\@]) ]}
    STRING            = rule {[ repeat(choice(ALPHANUM, MARK, ' ', '\\/', '\\*', '\\.')) ]}
    TOKEN             = rule {[ oneormore(choice(ALPHANUM, MARK)) ]}
    INTEGER           = rule {[ oneormore(DIGIT) ]}

    CHANNEL_SEGMENT   = rule {[ TOKEN ]}
    CHANNEL_SEGMENTS  = rule {[ CHANNEL_SEGMENT, repeat('\\/', CHANNEL_SEGMENT) ]}
    CHANNEL_NAME      = rule {[ '\\/', CHANNEL_SEGMENTS ]}

    WILD_CARD         = rule {[ '\\*{1,2}' ]}
    CHANNEL_PATTERN   = rule {[ repeat('\\/', CHANNEL_SEGMENT), '\\/', WILD_CARD ]}

    VERSION_ELEMENT   = rule {[ ALPHANUM, repeat(choice(ALPHANUM, '\\-', '\\_')) ]}
    VERSION           = rule {[ INTEGER, repeat('\\.', VERSION_ELEMENT) ]}

    CLIENT_ID         = rule {[ oneormore(ALPHANUM) ]}

    ID                = rule {[ oneormore(ALPHANUM) ]}

    ERROR_MESSAGE     = rule {[ STRING ]}
    ERROR_ARGS        = rule {[ STRING, repeat(',', STRING) ]}
    ERROR_CODE        = rule {[ DIGIT, DIGIT, DIGIT ]}
    ERROR             = rule {[ choice(string([ERROR_CODE, ':', ERROR_ARGS, ':', ERROR_MESSAGE]),
                                       string([ERROR_CODE, ':', ':', ERROR_MESSAGE])) ]}

  end
end
