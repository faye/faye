Faye.Error = Faye.Class({
  initialize: function(code, args, message) {
    this.code    = code;
    this.args    = Array.prototype.slice.call(args);
    this.message = message;
  },
  
  toString: function() {
    return this.code + ':' +
           this.args.join(',') + ':' +
           this.message;
  }
});

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

