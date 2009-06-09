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
  
  Grammar: {
<% %w[  LOWALPHA    UPALPHA     ALPHA     DIGIT
        ALPHANUM    MARK        STRING    TOKEN
        INTEGER
        
        CHANNEL_SEGMENT         CHANNEL_SEGMENTS
        CHANNEL_NAME
        
        WILD_CARD               CHANNEL_PATTERN
        
        VERSION_ELEMENT         VERSION
        
        CLIENT_ID               ID
        
        ERROR_MESSAGE           ERROR_ARGS
        ERROR_CODE              ERROR ].each do |bnf| %>
    <%= bnf %>:     /<%= Faye::Grammar.const_get(bnf).source %>/<%= bnf == 'ERROR' ? '' : ',' %>
<% end %>
  },
  
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
  },
  
  each: function(object, callback, scope) {
    if (object instanceof Array) {
      for (var i = 0, n = object.length; i < n; i++) {
        if (object[i] !== undefined)
          callback.call(scope || null, object[i], i);
      }
    } else {
      for (var key in object) {
        if (object.hasOwnProperty(key))
          callback.call(scope || null, key, object[key]);
      }
    }
  }
});

