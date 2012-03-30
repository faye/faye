Faye.StaticServer = Faye.Class({
  initialize: function(directory, pathRegex) {
    this._directory = directory;
    this._pathRegex = pathRegex;
    this._pathMap   = {};
    this._index     = {};
  },
  
  map: function(requestPath, filename) {
    this._pathMap[requestPath] = filename;
  },
  
  test: function(pathname) {
    return this._pathRegex.test(pathname);
  },
  
  serve: function(pathname, request, response) {
    pathname = path.basename(pathname);
    pathname = this._pathMap[pathname] || pathname;
    
    this._index[pathname] = this._index[pathname] || {};
    
    var cache    = this._index[pathname],
        fullpath = path.join(this._directory, pathname);
    
    cache.content = cache.content || fs.readFileSync(fullpath);
    cache.digest  = cache.digest  || crypto.createHash('sha1').update(cache.content).digest('hex');
    cache.mtime   = cache.mtime   || fs.statSync(fullpath).mtime;
    
    var headers = Faye.extend({}, Faye.NodeAdapter.prototype.TYPE_SCRIPT),
        ims     = request.headers['if-modified-since'];
    
    headers['ETag'] = cache.digest;
    headers['Last-Modified'] = cache.mtime.toGMTString();
    
    if (request.headers['if-none-match'] === cache.digest) {
      headers['Content-Length'] = '0';
      response.writeHead(304, headers);
      response.end();
    }
    else if (ims && cache.mtime <= new Date(ims)) {
      headers['Content-Length'] = '0';
      response.writeHead(304, headers);
      response.end();
    }
    else {
      headers['Content-Length'] = cache.content.length;
      response.writeHead(200, headers);
      response.write(cache.content);
      response.end();
    }
  }
});

