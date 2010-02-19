var path  = require('path'),
    posix = require('posix'),
    sys   = require('sys'),
    url   = require('url'),
    http  = require('http'),
    querystring = require('querystring');

Faye.NodeAdapter = Faye.Class({
  DEFAULT_ENDPOINT: '<%= Faye::RackAdapter::DEFAULT_ENDPOINT %>',
  SCRIPT_PATH:      path.dirname(__filename) + '/faye-client-min.js',
  
  TYPE_JSON:    {'Content-Type': 'text/json'},
  TYPE_SCRIPT:  {'Content-Type': 'text/javascript'},
  TYPE_TEXT:    {'Content-Type': 'text/plain'},
  
  initialize: function(options) {
    this._options  = options || {};
    this._endpoint = this._options.mount || this.DEFAULT_ENDPOINT;
    this._script   = this._endpoint + '.js';
    this._server   = new Faye.Server(this._options);
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
        self = this;
    
    switch (requestUrl.pathname) {
      
      case this._endpoint:
        var isGet = (request.method === 'GET');
        
        if (isGet)
          this._callWithParams(request, response, requestUrl.query);
        
        else
          request.addListener('body', function(chunk) {
            self._callWithParams(request, response, querystring.parse(chunk));
          });
        
        return true;
        break;
      
      case this._script:
        posix.cat(this.SCRIPT_PATH).addCallback(function(content) {
          response.sendHeader(200, self.TYPE_SCRIPT);
          response.sendBody(content);
          response.finish();
        });
        return true;
        break;
      
      default: return false;
    }
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
        response.sendHeader(200, type);
        response.sendBody(body);
        response.finish();
      });
    } catch (e) {
      response.sendHeader(400, {'Content-Type': 'text/plain'});
      response.sendBody('Bad request');
      response.finish();
    }
  }
});

exports.NodeAdapter = Faye.NodeAdapter;
exports.Client = Faye.Client;

