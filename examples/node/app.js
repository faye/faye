var fs    = require('fs'),
    path  = require('path'),
    sys   = require('sys'), 
    http  = require('http')
    faye  = require('./faye');

var PUBLIC_DIR = path.dirname(__filename) + '/../shared/public',
    comet      = new faye.NodeAdapter({mount: '/comet', timeout: 45}),
    
    port       = process.ARGV[2] || '8000';

sys.puts('Listening on ' + port);

http.createServer(function(request, response) {
  sys.puts(request.method + ' ' + request.url);
  if (comet.call(request, response)) return;
  
  var path = (request.url === '/') ? '/index.html' : request.url;
  
  fs.readFile(PUBLIC_DIR + path, function(err, content) {
    response.sendHeader(200, {'Content-Type': 'text/html'});
    response.write(content);
    response.close();
  });
}).listen(Number(port));

