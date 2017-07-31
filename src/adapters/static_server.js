'use strict';

var crypto = require('crypto'),
    fs     = require('fs'),
    path   = require('path'),
    url    = require('url');

var Class        = require('../util/class'),
    assign       = require('../util/assign'),
    contenttypes = require('./content_types');

var StaticServer = Class({
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

  call: function(request, response) {
    var pathname = url.parse(request.url, true).pathname,
        filename = path.basename(pathname);

    filename = this._pathMap[filename] || filename;
    this._index[filename] = this._index[filename] || {};

    var cache    = this._index[filename],
        fullpath = path.join(this._directory, filename);

    try {
      cache.content = cache.content || fs.readFileSync(fullpath);
      cache.digest  = cache.digest  || crypto.createHash('sha1').update(cache.content).digest('hex');
      cache.mtime   = cache.mtime   || fs.statSync(fullpath).mtime;
    } catch (error) {
      response.writeHead(404, {});
      return response.end();
    }

    var type = /\.js$/.test(pathname) ? 'TYPE_SCRIPT' : 'TYPE_JSON',
        ims  = request.headers['if-modified-since'];

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
      assign(headers, contenttypes[type]);
      response.writeHead(200, headers);
      response.end(cache.content);
    }
  }
});

module.exports = StaticServer;
