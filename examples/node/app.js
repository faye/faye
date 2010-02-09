var posix = require('posix'),
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
  
  posix.cat(PUBLIC_DIR + path).addCallback(function(content) {
    response.sendHeader(200, {'Content-Type': 'text/html'});
    response.sendBody(content);
    response.finish();
  });
}).listen(Number(port));


//================================================================
var clientA = comet.getClient();
var clientB = new faye.Client('http://0.0.0.0:' + port + '/comet');

sys.puts('Just kicking the tyres...');

clientA.connect(function() {
  clientB.connect(function() {
    clientA.subscribe('/jobs/A', function(msg) {
      sys.puts('Client A received: ' + msg.data);
    });

    clientB.subscribe('/jobs/B', function(msg) {
      sys.puts('Client B received: ' + msg.data);
    });

    sys.puts('A sending to B ...');
    clientA.publish('/jobs/B', {data: 56});

    sys.puts('B sending to A ...');
    clientB.publish('/jobs/A', {data: 34});
  });
});

