'use strict';

var path        = require('path'),
    querystring = require('querystring'),
    url         = require('url'),
    WebSocket   = require('faye-websocket'),
    EventSource = WebSocket.EventSource;

var constants       = require('../util/constants'),
    extend          = require('../util/extend'),
    idFromMessages  = require('../util/id_from_messages'),
    toJSON          = require('../util/to_json'),
    validateOptions = require('../util/validate_options'),
    Class           = require('../util/class'),
    Logging         = require('../mixins/logging'),
    Publisher       = require('../mixins/publisher'),
    Client          = require('../protocol/client'),
    Server          = require('../protocol/server'),
    contenttypes    = require('./content_types'),
    StaticServer    = require('./static_server');

var NodeAdapter = Class({ className: 'NodeAdapter',
  DEFAULT_ENDPOINT: '/bayeux',
  SCRIPT_PATH:      'faye-browser-min.js',

  VALID_JSONP_CALLBACK: /^[a-z_\$][a-z0-9_\$]*(\.[a-z_\$][a-z0-9_\$]*)*$/i,

  initialize: function(options) {
    this._options = options || {};
    validateOptions(this._options, ['engine', 'mount', 'ping', 'timeout', 'extensions', 'websocketExtensions']);

    this._extensions = [];
    this._endpoint   = this._options.mount || this.DEFAULT_ENDPOINT;
    this._endpointRe = new RegExp('^' + this._endpoint.replace(/\/$/, '') + '(/[^/]*)*(\\.[^\\.]+)?$');
    this._server     = Server.create(this._options);

    this._static = new StaticServer(path.join(__dirname, '..', '..', 'client'), /\.(?:js|map)$/);
    this._static.map(path.basename(this._endpoint) + '.js', this.SCRIPT_PATH);
    this._static.map('client.js', this.SCRIPT_PATH);

    var extensions = this._options.extensions,
        websocketExtensions = this._options.websocketExtensions,
        i, n;

    if (extensions) {
      extensions = [].concat(extensions);
      for (i = 0, n = extensions.length; i < n; i++)
        this.addExtension(extensions[i]);
    }

    if (websocketExtensions) {
      websocketExtensions = [].concat(websocketExtensions);
      for (i = 0, n = websocketExtensions.length; i < n; i++)
        this.addWebsocketExtension(websocketExtensions[i]);
    }
  },

  listen: function() {
    throw new Error('The listen() method is deprecated - use the attach() method to bind Faye to an http.Server');
  },

  addExtension: function(extension) {
    return this._server.addExtension(extension);
  },

  removeExtension: function(extension) {
    return this._server.removeExtension(extension);
  },

  addWebsocketExtension: function(extension) {
    this._extensions.push(extension);
  },

  close: function() {
    return this._server.close();
  },

  getClient: function() {
    return this._client = this._client || new Client(this._server);
  },

  attach: function(httpServer) {
    this._overrideListeners(httpServer, 'request', 'handle');
    this._overrideListeners(httpServer, 'upgrade', 'handleUpgrade');
  },

  _overrideListeners: function(httpServer, event, method) {
    var listeners = httpServer.listeners(event),
        self      = this;

    httpServer.removeAllListeners(event);

    httpServer.on(event, function(request) {
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

    request.originalUrl = request.url;

    request.on('error', function(error) { self._returnError(response, error) });
    response.on('error', function(error) { self._returnError(null, error) });

    if (this._static.test(requestUrl.pathname))
      return this._static.call(request, response);

    // http://groups.google.com/group/faye-users/browse_thread/thread/4a01bb7d25d3636a
    if (requestMethod === 'OPTIONS' || request.headers['access-control-request-method'] === 'POST')
      return this._handleOptions(response);

    if (EventSource.isEventSource(request))
      return this.handleEventSource(request, response);

    if (requestMethod === 'GET')
      return this._callWithParams(request, response, requestUrl.query);

    if (requestMethod === 'POST')
      return this._concatStream(request, function(data) {
        var type   = (request.headers['content-type'] || '').split(';')[0],
            params = (type === 'application/json')
                   ? {message: data}
                   : querystring.parse(data);

        request.body = data;
        this._callWithParams(request, response, params);
      }, this);

    this._returnError(response, {message: 'Unrecognized request type'});
  },

  _callWithParams: function(request, response, params) {
    if (!params.message)
      return this._returnError(response, {message: 'Received request with no message: ' + this._formatRequest(request)});

    try {
      this.debug('Received message via HTTP ' + request.method + ': ?', params.message);

      var message = this._parseJSON(params.message),
          jsonp   = params.jsonp || constants.JSONP_CALLBACK,
          isGet   = (request.method === 'GET'),
          type    = isGet ? contenttypes.TYPE_SCRIPT : contenttypes.TYPE_JSON,
          headers = extend({}, type),
          origin  = request.headers.origin;

      if (!this.VALID_JSONP_CALLBACK.test(jsonp))
        return this._returnError(response, {message: 'Invalid JSON-P callback: ' + jsonp});

      if (origin) headers['Access-Control-Allow-Origin'] = origin;
      headers['Cache-Control'] = 'no-cache, no-store';
      headers['X-Content-Type-Options'] = 'nosniff';

      this._server.process(message, request, function(replies) {
        var body = toJSON(replies);

        if (isGet) {
          body = '/**/' + jsonp + '(' + this._jsonpEscape(body) + ');';
          headers['Content-Disposition'] = 'attachment; filename=f.txt';
        }

        headers['Content-Length'] = new Buffer(body, 'utf8').length.toString();

        this.debug('HTTP response: ?', body);
        response.writeHead(200, headers);
        response.end(body);
      }, this);
    } catch (error) {
      this._returnError(response, error);
    }
  },

  _jsonpEscape: function(json) {
    return json.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  },

  handleUpgrade: function(request, socket, head) {
    var options  = {extensions: this._extensions, ping: this._options.ping},
        ws       = new WebSocket(request, socket, head, [], options),
        clientId = null,
        self     = this;

    request.originalUrl = request.url;

    ws.onmessage = function(event) {
      try {
        self.debug('Received message via WebSocket[' + ws.version + ']: ?', event.data);

        var message = self._parseJSON(event.data),
            cid     = idFromMessages(message);

        if (clientId && cid && cid !== clientId) self._server.closeSocket(clientId, false);
        self._server.openSocket(cid, ws, request);
        if (cid) clientId = cid;

        self._server.process(message, request, function(replies) {
          if (ws) ws.send(toJSON(replies));
        });
      } catch (error) {
        console.log(error.stack);
        self.error(error.message + '\nBacktrace:\n' + error.stack);
      }
    };

    ws.onclose = function(event) {
      self._server.closeSocket(clientId);
      ws = null;
    };
  },

  handleEventSource: function(request, response) {
    var es       = new EventSource(request, response, {ping: this._options.ping}),
        clientId = es.url.split('/').pop(),
        self     = this;

    this.debug('Opened EventSource connection for ?', clientId);
    this._server.openSocket(clientId, es, request);

    es.onclose = function(event) {
      self._server.closeSocket(clientId);
      es = null;
    };
  },

  _handleOptions: function(response) {
    var headers = {
      'Access-Control-Allow-Credentials': 'false',
      'Access-Control-Allow-Headers':     'Accept, Authorization, Content-Type, Pragma, X-Requested-With',
      'Access-Control-Allow-Methods':     'POST, GET',
      'Access-Control-Allow-Origin':      '*',
      'Access-Control-Max-Age':           '86400'
    };

    response.writeHead(200, headers);
    response.end('');
  },

  _concatStream: function(stream, callback, context) {
    var chunks = [],
        length = 0;

    stream.on('data', function(chunk) {
      chunks.push(chunk);
      length += chunk.length;
    });

    stream.on('end', function() {
      var buffer = new Buffer(length),
          offset = 0;

      for (var i = 0, n = chunks.length; i < n; i++) {
        chunks[i].copy(buffer, offset);
        offset += chunks[i].length;
      }
      callback.call(context, buffer.toString('utf8'));
    });
  },

  _parseJSON: function(json) {
    var data = JSON.parse(json);
    if (typeof data === 'object') return data;
    throw new SyntaxError('JSON messages must contain an object or array');
  },

  _formatRequest: function(request) {
    var method = request.method.toUpperCase(),
        string = 'curl -X ' + method;

    string += " 'http://" + request.headers.host + request.url + "'";
    if (method === 'POST') {
      string += " -H 'Content-Type: " + request.headers['content-type'] + "'";
      string += " -d '" + request.body + "'";
    }
    return string;
  },

  _returnError: function(response, error) {
    var message = error.message;
    if (error.stack) message += '\nBacktrace:\n' + error.stack;
    this.error(message);

    if (!response) return;

    response.writeHead(400, contenttypes.TYPE_TEXT);
    response.end('Bad request');
  }
});

for (var method in Publisher) (function(method) {
  NodeAdapter.prototype[method] = function() {
    return this._server._engine[method].apply(this._server._engine, arguments);
  };
})(method);

extend(NodeAdapter.prototype, Logging);

module.exports = NodeAdapter;
