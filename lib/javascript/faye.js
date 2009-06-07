if (!this.Faye) Faye = {};

Faye.extend = function(dest, source, overwrite) {
  if (!source) return dest;
  for (var key in source) {
    if (source.hasOwnProperty(key) && dest[key] !== source[key]) {
      if (!dest.hasOwnProperty(key) || overwrite !== false)
        dest[key] = source[key];
    }
  }
  return dest;
};

Faye.extend(Faye, {
  BAYEUX_VERSION: '1.0',
  ENV:  this,
  
  VERSION:  '<%= Faye::VERSION %>',
  
  Channel: {
    HANDSHAKE:    '<%= Faye::Channel::HANDSHAKE %>',
    CONNECT:      '<%= Faye::Channel::CONNECT %>',
    SUBSCRIBE:    '<%= Faye::Channel::SUBSCRIBE %>',
    UNSUBSCRIBE:  '<%= Faye::Channel::UNSUBSCRIBE %>',
    DISCONNECT:   '<%= Faye::Channel::DISCONNECT %>',
    ECHO:         '<%= Faye::Channel::ECHO %>'
  }
});

