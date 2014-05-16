module Faye
  class Error

    def self.method_missing(type, *args)
      code = const_get(type.to_s.upcase)
      new(code[0], args, code[1]).to_s
    end

    def self.parse(message)
      message ||= ''
      return new(nil, [], message) unless Grammar::ERROR =~ message

      parts   = message.split(':')
      code    = parts[0].to_i
      params  = parts[1].split(',')
      message = parts[2]

      new(code, params, message)
    end

    attr_reader :code, :params, :message

    def initialize(code, params, message)
      @code     = code
      @params   = params
      @message  = message
    end

    def to_s
      "#{ @code }:#{ @params * ',' }:#{ @message }"
    end

    # http://code.google.com/p/cometd/wiki/BayeuxCodes
    VERSION_MISMATCH    = [300, 'Version mismatch']
    CONNTYPE_MISMATCH   = [301, 'Connection types not supported']
    EXT_MISMATCH        = [302, 'Extension mismatch']
    BAD_REQUEST         = [400, 'Bad request']
    CLIENT_UNKNOWN      = [401, 'Unknown client']
    PARAMETER_MISSING   = [402, 'Missing required parameter']
    CHANNEL_FORBIDDEN   = [403, 'Forbidden channel']
    CHANNEL_UNKNOWN     = [404, 'Unknown channel']
    CHANNEL_INVALID     = [405, 'Invalid channel']
    EXT_UNKNOWN         = [406, 'Unknown extension']
    PUBLISH_FAILED      = [407, 'Failed to publish']
    SERVER_ERROR        = [500, 'Internal server error']

  end
end
