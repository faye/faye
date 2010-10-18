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
    if (this._clientScript) return callback(this._clientScript);
    var self = this;
    fs.readFile(this.SCRIPT_PATH, function(err, content) {
      self._clientScript = content;
      callback(content);
    });
  },
  
  handle: function(request, response) {
    var requestUrl = url.parse(request.url, true),
        self = this, data;
    
    if (/\.js$/.test(requestUrl.pathname)) {
      this.loadClientScript(function(content) {
        response.writeHead(200, self.TYPE_SCRIPT);
        response.write(content);
        response.end();
      });
      
    } else {
      var isGet = (request.method === 'GET');
      
      if (isGet)
        this._callWithParams(request, response, requestUrl.query);
      
      else
        Faye.withDataFor(request, function(data) {
          var type   = request.headers['content-type'].split(';')[0],
              
              params = (type === 'application/json')
                     ? {message: data}
                     : querystring.parse(data);
          
          self._callWithParams(request, response, params);
        });
    }
    return true;
  },
  
  handleUpgrade: function(request, socket, head) {
    var socket = new Faye.WebSocket(request, head),
        self   = this;
    
    socket.onmessage = function(message) {
      try {
        var message = JSON.parse(message.data);
        self._server.process(message, socket, function(replies) {
          socket.send(JSON.stringify(replies));
        });
      } catch (e) {}
    };
  },
  
  _callWithParams: function(request, response, params) {
    try {
      var message = JSON.parse(params.message),
          jsonp   = params.jsonp || Faye.JSONP_CALLBACK,
          isGet   = (request.method === 'GET'),
          type    = isGet ? this.TYPE_SCRIPT : this.TYPE_JSON;
      
      if (isGet) this._server.flushConnection(message);
      
      this._server.process(message, false, function(replies) {
        var body = JSON.stringify(replies);
        if (isGet) body = jsonp + '(' + body + ');';
        response.writeHead(200, type);
        response.write(body);
        response.end();
      });
    } catch (e) {
      response.writeHead(400, this.TYPE_TEXT);
      response.write('Bad request');
      response.end();
    }
  }
});

exports.NodeAdapter = Faye.NodeAdapter;
exports.Client = Faye.Client;
exports.Logging = Faye.Logging;

