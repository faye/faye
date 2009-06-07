Faye.URI = Faye.extend(Faye.Class({
  queryString: function() {
    var pairs = [], key;
    for (key in this.params) {
      if (!this.params.hasOwnProperty(key)) continue;
      pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(this.params[key]));
    }
    return pairs.join('&');
  },
  
  isLocal: function() {
    var host = Faye.URI.parse(window.location.href);
    
    var external = (host.hostname !== this.hostname) ||
                   (host.port !== this.port) ||
                   (host.protocol !== this.protocol);
    
    return !external;
  },
  
  toURL: function() {
    return this.protocol + this.hostname + ':' + this.port +
           this.pathname + '?' + this.queryString();
  }
}), {
  parse: function(url, params) {
    if (typeof url !== 'string') return url;
    
    var location = new this();
    
    var consume = function(name, pattern) {
      url = url.replace(pattern, function(match) {
        if (match) location[name] = match;
        return '';
      });
    };
    consume('protocol', /^https?\:\/+/);
    consume('hostname', /^[a-z0-9\-]+(\.[a-z0-9\-]+)*\.[a-z0-9\-]{2,6}/i);
    consume('port',     /^:[0-9]+/);
    
    Faye.extend(location, {
      protocol:   'http://',
      hostname:   window.location.hostname,
      port:       window.location.port
    }, false);
    
    if (!location.port) location.port = (location.protocol === 'https://') ? '443' : '80';
    location.port = location.port.replace(/\D/g, '');
    
    var parts = url.split('?'),
        path  = parts.shift(),
        query = parts.join('?'),
    
        pairs = query ? query.split('&') : [],
        n     = pairs.length,
        data  = {};
    
    while (n--) {
      parts = pairs[n].split('=');
      data[decodeURIComponent(parts[0] || '')] = decodeURIComponent(parts[1] || '');
    }
    Faye.extend(data, params);
    
    location.pathname = path;
    location.params = data;
    
    return location;
  }
});

