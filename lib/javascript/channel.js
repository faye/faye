Faye.Channel = {
  HANDSHAKE:    '<%= Faye::Channel::HANDSHAKE %>',
  CONNECT:      '<%= Faye::Channel::CONNECT %>',
  SUBSCRIBE:    '<%= Faye::Channel::SUBSCRIBE %>',
  UNSUBSCRIBE:  '<%= Faye::Channel::UNSUBSCRIBE %>',
  DISCONNECT:   '<%= Faye::Channel::DISCONNECT %>',
  ECHO:         '<%= Faye::Channel::ECHO %>',
  
  META:         '<%= Faye::Channel::META %>',
  
  valid: function(name) {
    return Faye.Grammar.CHANNEL_NAME.test(name) ||
           Faye.Grammar.CHANNEL_PATTERN.test(name);
  },
  
  parse: function(name) {
    if (!this.valid(name)) return null;
    return name.split('/').slice(1);
  },
  
  meta: function(name) {
    var segments = this.parse(name);
    return segments ? (segments[0] === this.META) : null;
  }
};

