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
  },
  
  commonElement: function(lista, listb) {
    for (var i = 0, n = lista.length; i < n; i++) {
      if (this.indexOf(listb, lista[i]) !== -1)
        return lista[i];
    }
    return null;
  },
  
  indexOf: function(list, needle) {
    for (var i = 0, n = list.length; i < n; i++) {
      if (list[i] === needle) return i;
    }
    return -1;
  }
});

