var fs    = require('fs'),
    path  = require('path'),
    sys   = require('sys'),
    faye  = require('./faye-node');

var PUBLIC_DIR = path.dirname(__filename) + '/../shared/public',
    bayeux     = new faye.NodeAdapter({mount: '/bayeux', timeout: 20}),
    
    port       = process.ARGV[2] || '8000';

sys.puts('Listening on ' + port);

bayeux.addListener('passthrough', function(request, response) {
  var path = (request.url === '/') ? '/index.html' : request.url;
  
  fs.readFile(PUBLIC_DIR + path, function(err, content) {
    response.writeHead(200, {'Content-Type': 'text/html'});
    response.write(content);
    response.end();
  });
});

bayeux.listen(Number(port));

