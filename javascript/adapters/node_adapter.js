var path  = require('path'),
    fs    = require('fs'),
    sys   = require('sys'),
    url   = require('url'),
    http  = require('http'),
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
  
  getClient: function() {
    return this._client = this._client || new Faye.Client(this._server);
  },
  
  listen: function(port) {
    var httpServer = http.createServer(function() {});
    this.attach(httpServer);
    httpServer.listen(port);
    this._httpServer = httpServer;
  },
  
  stop: function() {
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
  
  loadClientScript: function(callback) {
    var self = this;
    fs.readFile(this.SCRIPT_PATH, function(err, content) {
      self._clientScript = content;
      callback(content);
    });
  },
  
  handle: function(request, response) {
    var requestUrl    = url.parse(request.url, true),
        requestMethod = request.method,
        self          = this;
    
    if (/\.js$/.test(requestUrl.pathname))
      return this.loadClientScript(function(content) {
        response.writeHead(200, self.TYPE_SCRIPT);
        response.write(content);
        response.end();
      });
    
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
    var socket = new Faye.WebSocket(request, head),
        self   = this;
    
    var send = function(messages) {
      try {
        self.debug('Sending via WebSocket: ?', messages);
        socket.send(JSON.stringify(messages));
      } catch (e) {
        self._failed[socket.clientId] = messages;
      }
    };
    
    socket.onmessage = function(message) {
      try {
        var message  = JSON.parse(message.data),
            clientId = self._server.determineClient(message),
            failed   = null;
        
        self.debug('Received via WebSocket: ?', message);

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
  
  _callWithParams: function(request, response, params) {
    try {
      var message = JSON.parse(params.message),
          jsonp   = params.jsonp || Faye.JSONP_CALLBACK,
          isGet   = (request.method === 'GET'),
          type    = isGet ? this.TYPE_SCRIPT : this.TYPE_JSON;

      this.debug('Received ?: ?', request.method, message);
      if (isGet) this._server.flushConnection(message);
      
      this._server.process(message, false, function(replies) {
        var body   = JSON.stringify(replies),
            head   = Faye.extend({}, type),
            origin = request.headers.origin;
        
        if (isGet)  body = jsonp + '(' + body + ');';
        if (origin) head['Access-Control-Allow-Origin'] = origin;
        
        this.debug('Returning ?', body);
        response.writeHead(200, head);
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
exports.Client = Faye.Client;
exports.Logging = Faye.Logging;

