'use strict';

var crypto = require('crypto'),
    fs     = require('fs'),
    path   = require('path');

var Class        = require('../util/class'),
    URI          = require('../util/uri'),
    contenttypes = require('./content_types');

var StaticServer = Class({
  URL_BASE: 'http://localhost',

  initialize: function(directory, pathRegex) {
    this._directory = directory;
    this._pathRegex = pathRegex;
    this._pathMap   = new Map();
    this._index     = new Map();

    try {
      this._fillCache();
    } catch (error) {}
  },

  map: function(requestPath, filename) {
    this._pathMap.set(requestPath, filename);
  },

  test: function(pathname) {
    return this._pathRegex.test(pathname);
  },

  call: function(request, response) {
    var pathname = URI.parse(this.URL_BASE + request.url).pathname,
        filename = path.basename(pathname);

    filename = this._pathMap.get(filename) || filename;

    if (!this._index.has(filename)) {
      response.writeHead(404, {});
      return response.end();
    }

    var cache = this._index.get(filename),
        type  = /\.js$/.test(filename) ? 'TYPE_SCRIPT' : 'TYPE_JSON',
        ims   = request.headers['if-modified-since'];

    var headers = {
      'ETag':          cache.digest,
      'Last-Modified': cache.mtime.toGMTString()
    };

    if (request.headers['if-none-match'] === cache.digest) {
      response.writeHead(304, headers);
      response.end();
    }
    else if (ims && cache.mtime <= new Date(ims)) {
      response.writeHead(304, headers);
      response.end();
    }
    else {
      headers['Content-Length'] = cache.content.length;
      Object.assign(headers, contenttypes[type]);
      response.writeHead(200, headers);
      response.end(cache.content);
    }
  },

  _fillCache: function() {
    var entries = fs.readdirSync(this._directory);

    for (let entry of entries) {
      var fullpath = path.join(this._directory, entry);
      var content  = fs.readFileSync(fullpath);
      var digest   = crypto.createHash('sha1').update(content).digest('hex');
      var mtime    = fs.statSync(fullpath).mtime;

      this._index.set(entry, {
        content: content,
        digest:  digest,
        mtime:   mtime
      });
    }
  }
});

module.exports = StaticServer;
