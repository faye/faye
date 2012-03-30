var crypto = require('crypto'),
    fs     = require('fs'),
    http   = require('http'),
    https  = require('https'),
    net    = require('net'),
    path   = require('path'),
    tls    = require('tls'),
    url    = require('url'),
    querystring = require('querystring');

Faye.WebSocket   = require('faye-websocket');
Faye.EventSource = Faye.WebSocket.EventSource;
Faye.CookieJar   = require('cookiejar').CookieJar;

Faye.withDataFor = function(transport, callback, context) {
  var data = '';
  transport.addListener('data', function(chunk) { data += chunk });
  transport.addListener('end', function() {
    callback.call(context, data);
  });
};

Faye.NodeAdapter = Faye.Class({
  DEFAULT_ENDPOINT: '<%= Faye::RackAdapter::DEFAULT_ENDPOINT %>',
  SCRIPT_PATH:      'faye-browser-min.js',
  
  TYPE_JSON:    {'Content-Type': 'application/json'},
  TYPE_SCRIPT:  {'Content-Type': 'text/javascript'},
  TYPE_TEXT:    {'Content-Type': 'text/plain'},
  
  initialize: function(options) {
    this._options    = options || {};
    this._endpoint   = this._options.mount || this.DEFAULT_ENDPOINT;
    this._endpointRe = new RegExp('^' + this._endpoint + '(/[^/]+)*(\\.[^\\.]+)?$');
    this._server     = new Faye.Server(this._options);
    
    this._static = new Faye.StaticServer(path.dirname(__filename), /\.(?:js|map)$/);
    this._static.map(path.basename(this._endpoint) + '.js', this.SCRIPT_PATH);
    this._static.map('client.js', this.SCRIPT_PATH);
    
    var extensions = this._options.extensions;
    if (!extensions) return;
    
    extensions = [].concat(extensions);
    for (var i = 0, n = extensions.length; i < n; i++)
      this.addExtension(extensions[i]);
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
  
  listen: function(port, sslOptions, callback, context) {
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
      if (callback) callback.call(context);
    });
    this._httpServer = httpServer;
  },
  
  stop: function(callback, context) {
    this._httpServer.addListener('close', function() {
      if (callback) callback.call(context);
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
    
    if (this._static.test(requestUrl.pathname))
      return this._static.serve(requestUrl.pathname, request, response);
    
    if (requestMethod === 'OPTIONS')
      return this._handleOptions(request, response);
    
    if (Faye.EventSource.isEventSource(request))
      return this.handleEventSource(request, response);
    
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
    var ws       = new Faye.WebSocket(request, socket, head, null, {ping: this._options.ping}),
        clientId = null,
        self     = this;
    
    ws.onmessage = function(event) {
      try {
        var message = JSON.parse(event.data);
        clientId = Faye.clientIdFromMessages(message);
        
        self.debug('Received via WebSocket[' + ws.version + ']: ?', message);
        self._server.openSocket(clientId, ws);
        
        self._server.process(message, false, function(replies) {
          if (ws) ws.send(JSON.stringify(replies));
        });
      } catch (e) {
        self.error(e.message + '\nBacktrace:\n' + e.stack);
      }
    };
    
    ws.onclose = function(event) {
      self._server.closeSocket(clientId);
      ws = null;
    };
  },
  
  handleEventSource: function(request, response) {
    var es       = new Faye.EventSource(request, response, {ping: this._options.ping}),
        clientId = es.url.split('/').pop(),
        self     = this;
    
    this.debug('Opened EventSource connection for ?', clientId);
    this._server.openSocket(clientId, es);
    
    es.onclose = function(event) {
      self._server.closeSocket(clientId);
      es = null;
    };
  },
  
  _callWithParams: function(request, response, params) {
    try {
      var message = JSON.parse(params.message),
          jsonp   = params.jsonp || Faye.JSONP_CALLBACK,
          isGet   = (request.method === 'GET'),
          type    = isGet ? this.TYPE_SCRIPT : this.TYPE_JSON,
          headers = Faye.extend({}, type),
          origin  = request.headers.origin;

      this.debug('Received ?: ?', request.method, message);
      if (isGet) this._server.flushConnection(message);
      
      if (origin) headers['Access-Control-Allow-Origin'] = origin;
      if (isGet)  headers['Cache-Control'] = 'no-cache, no-store';
      
      this._server.process(message, false, function(replies) {
        var body = JSON.stringify(replies);
        if (isGet) body = jsonp + '(' + body + ');';
        headers['Content-Length'] = new Buffer(body, 'utf8').length.toString();
        
        this.debug('Returning ?', body);
        response.writeHead(200, headers);
        response.write(body);
        response.end();
      }, this);
    } catch (e) {
      this.error(e.message + '\nBacktrace:\n' + e.stack);
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

module.exports = Faye;

