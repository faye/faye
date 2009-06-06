if (!this.Faye) Faye = {};

Faye.extend = function(dest, source) {
  if (!source) return dest;
  for (var key in source) {
    if (source.hasOwnProperty(key) && dest[key] !== source[key])
      dest[key] = source[key];
  }
  return dest;
};

Faye.ENV = this;

