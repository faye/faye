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
  SCRIPT_PATH:      path.dirname(__filename) + '/faye-client-min.js',
  
  TYPE_JSON:    {'Content-Type': 'application/json'},
  TYPE_SCRIPT:  {'Content-Type': 'text/javascript'},
  TYPE_TEXT:    {'Content-Type': 'text/plain'},
  
  initialize: function(options) {
    this._options    = options || {};
    this._endpoint   = this._options.mount || this.DEFAULT_ENDPOINT;
    this._endpointRe = new RegExp('^' + this._endpoint + '(/[^/]+)*(\\.js)?$');
    this._server     = new Faye.Server(this._options);
  },
  
  getClient: function() {
    return this._client = this._client || new Faye.Client(this._server);
  },
  
  run: function(port) {
    var self = this;
    http.createServer(function(request, response) {
      self.call(request, response);
    }).listen(Number(port));
  },
  
  call: function(request, response) {
    var requestUrl = url.parse(request.url, true),
        self = this, data;
    
    if (!this._endpointRe.test(requestUrl.pathname))
      return false;
    
    if (/\.js$/.test(requestUrl.pathname)) {
      fs.readFile(this.SCRIPT_PATH, function(err, content) {
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
          self._callWithParams(request, response, {message: data});
        });
    }
    return true;
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

