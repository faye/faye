var path  = require('path'),
    posix = require('posix'),
    sys   = require('sys'),
    url   = require('url'),
    querystring = require('querystring');

Faye.NodeAdapter = Faye.Class({
  initialize: function(options) {
    this._options  = options || {};
    this._endpoint = this._options.mount || Faye.NodeAdapter.DEFAULT_ENDPOINT;
    this._script   = this._endpoint + '.js';
    this._server   = new Faye.Server(this._options);
  },
  
  call: function(request, response) {
    var requestUrl = url.parse(request.url, true);
    switch (requestUrl.pathname) {
      
      case this._endpoint:
        var isGet = (request.method === 'GET'),
            self  = this;
        
        if (isGet)
          this._callWithParams(request, response, requestUrl.query);
        
        else
          request.addListener('body', function(chunk) {
            self._callWithParams(request, response, querystring.parse(chunk));
          });
        
        return true;
        break;
      
      case this._script:
        posix.cat(Faye.NodeAdapter.SCRIPT_PATH).addCallback(function(content) {
          response.sendHeader(200, Faye.NodeAdapter.TYPE_SCRIPT);
          response.sendBody(content);
          response.finish();
        });
        return true;
        break;
      
      default: return false;
    }
  },
  
  _callWithParams: function(request, response, params) {
    var message = JSON.parse(params.message),
        jsonp   = params.jsonp || Faye.JSONP_CALLBACK,
        isGet   = (request.method === 'GET'),
        type    = isGet ? Faye.NodeAdapter.TYPE_SCRIPT : Faye.NodeAdapter.TYPE_JSON;
    
    if (isGet) this._server.flushConnection(message);
    
    this._server.process(message, false, function(replies) {
      var body = JSON.stringify(replies);
      if (isGet) body = jsonp + '(' + body + ');';
      response.sendHeader(200, type);
      response.sendBody(body);
      response.finish();
    });
  }
});

Faye.extend(Faye.NodeAdapter, {
  DEFAULT_ENDPOINT: '<%= Faye::RackAdapter::DEFAULT_ENDPOINT %>',
  SCRIPT_PATH:      path.dirname(__filename) + '/faye-client-min.js',
  
  TYPE_JSON:    {'Content-Type': 'text/json'},
  TYPE_SCRIPT:  {'Content-Type': 'text/javascript'},
  TYPE_TEXT:    {'Content-Type': 'text/plain'}
});

exports.NodeAdapter = Faye.NodeAdapter;

