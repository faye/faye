if (!this.Faye) Faye = {};

Faye.extend = function(dest, source) {
  if (!source) return dest;
  for (var key in source) {
    if (source.hasOwnProperty(key) && dest[key] !== source[key])
      dest[key] = source[key];
  }
  return dest;
};

Faye.extend(Faye, {
  BAYEUX_VERSION: '1.0',
  ENV:  this,
  
  Channel: {
    HANDSHAKE:    '/meta/handshake',
    CONNECT:      '/meta/connect',
    SUBSCRIBE:    '/meta/subscribe',
    UNSUBSCRIBE:  '/meta/unsubscribe',
    DISCONNECT:   '/meta/disconnect',
    ECHO:         '/service/echo'
  }
});

