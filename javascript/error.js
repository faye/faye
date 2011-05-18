Faye.Error = Faye.Class({
  initialize: function(code, params, message) {
    this.code    = code;
    this.params  = Array.prototype.slice.call(params);
    this.message = message;
  },
  
  toString: function() {
    return this.code + ':' +
           this.params.join(',') + ':' +
           this.message;
  }
});

Faye.Error.parse = function(message) {
  message = message || '';
  if (!Faye.Grammar.ERROR.test(message)) return new this(null, [], message);

  var parts   = message.split(':'),
      code    = parseInt(parts[0]),
      params  = parts[1].split(','),
      message = parts[2];

  return new this(code, params, message);
};

<% %w[ VERSION_MISMATCH
       CONNTYPE_MISMATCH
       EXT_MISMATCH
       BAD_REQUEST
       CLIENT_UNKNOWN
       PARAMETER_MISSING
       CHANNEL_FORBIDDEN
       CHANNEL_UNKNOWN
       CHANNEL_INVALID
       EXT_UNKNOWN
       PUBLISH_FAILED
       SERVER_ERROR ].each do |error_type|
  
  code, message = Faye::Error.const_get(error_type)
  js_method = error_type.downcase.gsub(/_(.)/) { $1.upcase }
%>
Faye.Error.<%= js_method %> = function() {
  return new this(<%= code %>, arguments, <%= message.inspect %>).toString();
};
<% end %>

