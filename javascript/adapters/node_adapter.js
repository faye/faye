var crypto = require('crypto'),
    fs     = require('fs'),
    http   = require('http'),
    https  = require('https'),
    net    = require('net'),
    path   = require('path'),
    sys    = require('sys'),
    tls    = require('tls'),
    url    = require('url'),
    querystring = require('querystring');

Faye.logger = function(message) {
  sys.puts(message);
};

Faye.withDataFor = function(transport, callback, scope) {
  var data = '';
  transport.addListener('data', function(chunk) { data += chunk });
  transport.addListener('end', function() {
    callback.call(scope, data);
  });
};

Faye.NodeAdapter = Faye.Class({
  DEFAULT_ENDPOINT: '<%= Faye::RackAdapter::DEFAULT_ENDPOINT %>',
  SCRIPT_PATH:      path.dirname(__filename) + '/faye-browser-min.js',
  
  TYPE_JSON:    {'Content-Type': 'application/json'},
  TYPE_SCRIPT:  {'Content-Type': 'text/javascript'},
  TYPE_TEXT:    {'Content-Type': 'text/plain'},
  
  initialize: function(options) {
    this._options    = options || {};
    this._endpoint   = this._options.mount || this.DEFAULT_ENDPOINT;
    this._endpointRe = new RegExp('^' + this._endpoint + '(/[^/]*)*(\\.js)?$');
    this._server     = new Faye.Server(this._options);
    this._failed     = {};
    
    var extensions = this._options.extensions;
    if (!extensions) return;
    Faye.each([].concat(extensions), this.addExtension, this);
  },
  
  addExtension: function(extension) {
    return this._server.addExtension(extension);
  },
  
  removeExtension: function(extension) {
    return this._server.removeExtension(extension);
  },
  
  bind: function() {
    return this._server._engine.bind.apply(this._server._engine, arguments);
  },
  
  unbind: function() {
    return this._server._engine.unbind.apply(this._server._engine, arguments);
  },
  
  getClient: function() {
    return this._client = this._client || new Faye.Client(this._server);
  },
  
  listen: function(port, sslOptions, callback, scope) {
    var ssl = sslOptions && sslOptions.cert
            ? { key:  fs.readFileSync(sslOptions.key),
                cert: fs.readFileSync(sslOptions.cert)
              }
            : null;
    
    if (ssl && sslOptions.ca)
      ssl.ca = Faye.map(sslOptions.ca, function(ca) { return fs.readFileSync(ca) });
    
    var httpServer = ssl
                   ? https.createServer(ssl, function() {})
                   : http.createServer(function() {});
    
    this.attach(httpServer);
    httpServer.listen(port, function() {
      if (callback) callback.call(scope);
    });
    this._httpServer = httpServer;
  },
  
  stop: function(callback, scope) {
    this._httpServer.addListener('close', function() {
      if (callback) callback.call(scope);
    });
    this._httpServer.close();
  },
  
  attach: function(httpServer) {
    this._overrideListeners(httpServer, 'request', 'handle');
    this._overrideListeners(httpServer, 'upgrade', 'handleUpgrade');
  },
  
  _overrideListeners: function(httpServer, event, method) {
    var listeners = httpServer.listeners(event),
        self      = this;
    
    httpServer.removeAllListeners(event);
    
    httpServer.addListener(event, function(request) {
      if (self.check(request)) return self[method].apply(self, arguments);
      
      for (var i = 0, n = listeners.length; i < n; i++)
        listeners[i].apply(this, arguments);
    });
  },
  
  check: function(request) {
    var path = url.parse(request.url, true).pathname;
    return !!this._endpointRe.test(path);
  },
  
  handle: function(request, response) {
    var requestUrl    = url.parse(request.url, true),
        requestMethod = request.method,
        self          = this;
    
    if (/\.js$/.test(requestUrl.pathname))
      return this._serveClientScript(request, response);
    
    if (requestMethod === 'OPTIONS')
      return this._handleOptions(request, response);
    
    if (requestMethod === 'GET')
      return this._callWithParams(request, response, requestUrl.query);
    
    if (requestMethod === 'POST')
      return Faye.withDataFor(request, function(data) {
        var type   = (request.headers['content-type'] || '').split(';')[0],
            params = (type === 'application/json')
                   ? {message: data}
                   : querystring.parse(data);
        
        self._callWithParams(request, response, params);
      });
    
    this._returnError(response);
  },
  
  handleUpgrade: function(request, socket, head) {
    var socket = new Faye.WebSocket(request, socket, head),
        self   = this;
    
    var send = function(messages) {
      self.debug('Sending via WebSocket[' + socket.version + ']: ?', messages);
      if (!socket.send(JSON.stringify(messages)))
        self._failed[socket.clientId] = messages;
    };
    
    socket.onmessage = function(message) {
      try {
        var message  = JSON.parse(message.data),
            clientId = self._server.determineClient(message),
            failed   = null;
        
        self.debug('Received via WebSocket[' + socket.version + ']: ?', message);

        if (clientId) {
          socket.clientId = clientId;
          if (failed = self._failed[clientId]) {
            delete self._failed[clientId];
            send(failed);
          }
        }
        
        self._server.process(message, false, send);
      } catch (e) {}
    };
  },
  
  _serveClientScript: function(request, response) {
    this._clientScript = this._clientScript || fs.readFileSync(this.SCRIPT_PATH);
    this._clientDigest = this._clientDigest || crypto.createHash('sha1').update(this._clientScript).digest('hex');
    this._clientMtime  = this._clientMtime  || fs.statSync(this.SCRIPT_PATH).mtime;
    
    var headers = Faye.extend({}, this.TYPE_SCRIPT),
        ims     = request.headers['if-modified-since'];
    
    headers['ETag'] = this._clientDigest;
    headers['Last-Modified'] = this._clientMtime.toGMTString();
    
    if (request.headers['if-none-match'] === this._clientDigest) {
      response.writeHead(304, headers);
      response.end();
    } else if (ims && this._clientMtime <= new Date(ims)) {
      response.writeHead(304, headers);
      response.end();
    } else {
      response.writeHead(200, headers);
      response.write(this._clientScript);
      response.end();
    }
  },
  
  _callWithParams: function(request, response, params) {
    try {
      var message = JSON.parse(params.message),
          jsonp   = params.jsonp || Faye.JSONP_CALLBACK,
          isGet   = (request.method === 'GET'),
          type    = isGet ? this.TYPE_SCRIPT : this.TYPE_JSON;

      this.debug('Received ?: ?', request.method, message);
      if (isGet) this._server.flushConnection(message);
      
      this._server.process(message, false, function(replies) {
        var body    = JSON.stringify(replies),
            headers = Faye.extend({}, type),
            origin  = request.headers.origin;
        
        if (isGet) {
          body = jsonp + '(' + body + ');';
          headers['Cache-Control'] = 'no-cache, no-store';
        }
        if (origin) headers['Access-Control-Allow-Origin'] = origin;
        
        this.debug('Returning ?', body);
        response.writeHead(200, headers);
        response.write(body);
        response.end();
      }, this);
    } catch (e) {
      this._returnError(response);
    }
  },
  
  _handleOptions: function(request, response) {
    var headers = {
      'Access-Control-Allow-Origin':      '*',
      'Access-Control-Allow-Credentials': 'false',
      'Access-Control-Max-Age':           '86400',
      'Access-Control-Allow-Methods':     'POST, GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':     'Accept, Content-Type, X-Requested-With'
    };
    response.writeHead(200, headers);
    response.write('');
    response.end();
  },
  
  _returnError: function(response) {
    response.writeHead(400, this.TYPE_TEXT);
    response.write('Bad request');
    response.end();
  }
});

Faye.extend(Faye.NodeAdapter.prototype, Faye.Logging);

exports.NodeAdapter = Faye.NodeAdapter;
exports.Client      = Faye.Client;
exports.Logging     = Faye.Logging;
exports.WebSocket   = Faye.WebSocket;

