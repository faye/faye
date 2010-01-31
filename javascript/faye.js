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
  BAYEUX_VERSION:   '<%= Faye::BAYEUX_VERSION %>',
  VERSION:          '<%= Faye::VERSION %>',
  JSONP_CALLBACK:   '<%= Faye::JSONP_CALLBACK %>',
  ID_LENGTH:        <%= Faye::ID_LENGTH %>,
  CONNECTION_TYPES: <%= Faye::CONNECTION_TYPES.inspect %>,
  
  ENV:              this,
  
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
  },
  
  size: function(object) {
    var size = 0;
    this.each(object, function() { size += 1 });
    return size;
  },
  
  random: function() {
    var field = Math.pow(2, this.ID_LENGTH);
    return (Math.random() * field).toString(16).replace(/0*$/, '');
  },
  
  enumEqual: function(actual, expected) {
    if (expected instanceof Array) {
      if (!(actual instanceof Array)) return false;
      var i = actual.length;
      if (i !== expected.length) return false;
      while (i--) {
        if (actual[i] !== expected[i]) return false;
      }
      return true;
    } else {
      if (!(actual instanceof Object)) return false;
      if (this.size(expected) !== this.size(actual)) return false;
      var result = true;
      this.each(actual, function(key, value) {
        result = result && (expected[key] === value);
      });
      return result;
    }
  }
});

