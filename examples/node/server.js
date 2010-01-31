var posix = require('posix'),
    path  = require('path'),
    sys   = require('sys'), 
    http  = require('http');

var PUBLIC_DIR = path.dirname(__filename) + '/../shared/public';

http.createServer(function(request, response) {
  var path = (request.url === '/') ? '/index.html' : request.url;
  posix.cat(PUBLIC_DIR + path).addCallback(function(content) {
    response.sendHeader(200, {'Content-Type': 'text/html'});
    response.sendBody(content);
    response.finish();
  });
}).listen(9292);

