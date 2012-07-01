Faye.URI = Faye.extend(Faye.Class({
  queryString: function() {
    var pairs = [];
    for (var key in this.params) {
      if (!this.params.hasOwnProperty(key)) continue;
      pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(this.params[key]));
    }
    return pairs.join('&');
  },
  
  isLocal: function() {
    var host = Faye.URI.parse(Faye.ENV.location.href);
    
    var external = (host.hostname !== this.hostname) ||
                   (host.port !== this.port) ||
                   (host.protocol !== this.protocol);
    
    return !external;
  },
  
  toURL: function() {
    var query = this.queryString();
    return this.protocol + this.hostname + (this.port ? ':' + this.port : '') +
           this.pathname + (query ? '?' + query : '');
  }
}), {
  parse: function(url, params) {
    if (typeof url !== 'string') return url;
    
    var a   = document.createElement('a'),
        uri = new this();
    
    a.href = url;
    
    uri.protocol = a.protocol + '//';
    uri.hostname = a.hostname;
    uri.pathname = a.pathname;
    
    if ((a.port === "0") || (a.port === "")) {
      uri.port = "80";
    } else {
      uri.port = a.port;
    }
    
    var query = a.search.replace(/^\?/, ''),
        pairs = query ? query.split('&') : [],
        n     = pairs.length,
        data  = {},
        parts;
    
    while (n--) {
      parts = pairs[n].split('=');
      data[decodeURIComponent(parts[0] || '')] = decodeURIComponent(parts[1] || '');
    }
    if (typeof params === 'object') Faye.extend(data, params);
    
    uri.params = data;
    
    return uri;
  }
});

