var path  = require('path'),
    posix = require('posix'),
    sys   = require('sys'),
    querystring = require('querystring');

Faye.NodeAdapter = Faye.Class({
  initialize: function(options) {
    this._options  = options || {};
    this._endpoint = this._options.mount || Faye.NodeAdapter.DEFAULT_ENDPOINT;
    this._script   = this._endpoint + '.js';
    this._server   = new Faye.Server(this._options);
  },
  
  call: function(request, response) {
    switch (request.url) {
      
      case this._endpoint:
        var isGet  = (request.method === 'GET'),
            type   = isGet ? Faye.NodeAdapter.TYPE_SCRIPT : Faye.NodeAdapter.TYPE_JSON,
            server = this._server;
        
        if (isGet) {
          // TODO
        } else {
          request.addListener('body', function(chunk) {
            var params  = querystring.parse(chunk),
                message = JSON.parse(params.message),
                jsonp   = params.jsonp || Faye.JSONP_CALLBACK;
            
            server.process(message, false, function(replies) {
              response.sendHeader(200, type);
              response.sendBody(JSON.stringify(replies));
              response.finish();
            });
          });
        }
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

