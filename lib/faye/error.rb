module Faye
  class Error
    
    def self.parse(string)
      return nil unless Grammar::ERROR =~ string
      parts = string.split(':')
      args  = parts[1].split(',')
      new(parts[0].to_i, args, parts[2])
    end
    
    def self.method_missing(type, message = '', args = [])
      code = const_get(type.to_s.upcase)
      new(code, args, message).to_s
    end
    
    attr_reader :code, :args, :message
    
    def initialize(code, args, message)
      @code     = code
      @args     = args
      @message  = message
    end
    
    def to_s
      "#{ @code }:#{ @args * ',' }:#{ @message }"
    end
    
    # http://code.google.com/p/cometd/wiki/BayeuxCodes
    VERSION_MISMATCH    = 300
    CONNTYPE_MISMATCH   = 301
    EXT_MISMATCH        = 302
    BAD_REQUEST         = 400
    CLIENT_UNKNOWN      = 401
    PARAMETER_MISSING   = 402
    CHANNEL_FORBIDDEN   = 403
    CHANNEL_UNKNOWN     = 404
    CHANNEL_INVALID     = 405
    EXT_UNKNOWN         = 406
    PUBLISH_FAILED      = 407
    SERVER_ERROR        = 500
    
  end
end

