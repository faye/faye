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

<%  // http://code.google.com/p/cometd/wiki/BayeuxCodes
    errors = {
      versionMismatch:  [300, 'Version mismatch'],
      conntypeMismatch: [301, 'Connection types not supported'],
      extMismatch:      [302, 'Extension mismatch'],
      badRequest:       [400, 'Bad request'],
      clientUnknown:    [401, 'Unknown client'],
      parameterMissing: [402, 'Missing required parameter'],
      channelForbidden: [403, 'Forbidden channel'],
      channelUnknown:   [404, 'Unknown channel'],
      channelInvalid:   [405, 'Invalid channel'],
      extUnknown:       [406, 'Unknown extension'],
      publishFailed:    [407, 'Failed to publish'],
      serverError:      [500, 'Internal server error']
    }
%>

<% for (var name in errors) { %>
Faye.Error.<%- name %> = function() {
  return new this(<%- errors[name][0] %>, arguments, '<%- errors[name][1] %>').toString();
};
<% } %>

